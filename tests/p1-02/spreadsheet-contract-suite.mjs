import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CAPABILITY_IDS,
  COMMAND_TYPES,
  ERROR_CODES,
  LIFECYCLE_STATES,
} from "../../packages/sdk/index.mjs";

function snapshotWithSheetOrder(sheetIds = ["details", "summary"]) {
  const sheets = {
    details: {
      index: "details",
      name: "费用明细",
      celldata: [{ r: 1, c: 2, v: { v: 100, m: "100" } }],
    },
    summary: {
      index: "summary",
      name: "汇总",
      celldata: [{ r: 0, c: 0, v: { v: "总费用", m: "总费用" } }],
    },
  };
  return {
    schemaVersion: 1,
    dataFormat: "luckysheet",
    workbook: { sheets: sheetIds.map(sheetId => sheets[sheetId]) },
    extensions: {},
  };
}

function findCell(snapshot, sheetId, row, column) {
  const worksheet = snapshot.workbook.sheets.find(
    sheet => String(sheet.sheetId ?? sheet.index) === sheetId
  );
  return worksheet?.celldata?.find(cell => cell.r === row && cell.c === column)
    ?.v;
}

function expectCode(code) {
  return error => error && error.code === code;
}

export function defineSpreadsheetContractSuite({
  implementationName,
  create,
  createHost = () => ({}),
}) {
  const contractTest = (name, run) =>
    test(`${implementationName} contract: ${name}`, run);

  async function createInstance(options = {}) {
    return create(createHost(), {
      snapshot: snapshotWithSheetOrder(),
      ...options,
    });
  }

  contractTest("create resolves only with a ready instance", async () => {
    const instance = await createInstance();
    assert.equal(instance.state, LIFECYCLE_STATES.READY);
    const readyEvent = await new Promise(resolve =>
      instance.on("ready", resolve)
    );
    assert.deepEqual(readyEvent, { type: "ready", state: "ready" });
    instance.destroy();
  });

  contractTest(
    "create failures do not return a half-initialized instance",
    async () => {
      await assert.rejects(
        () =>
          create(createHost(), {
            snapshot: { ...snapshotWithSheetOrder(), schemaVersion: 2 },
          }),
        expectCode(ERROR_CODES.CREATE_FAILED)
      );
    }
  );

  contractTest("destroy is idempotent and emits destroy once", async () => {
    const instance = await createInstance();
    let destroyEvents = 0;
    instance.on("destroy", () => {
      destroyEvents += 1;
    });
    instance.destroy();
    instance.destroy();
    assert.equal(instance.state, LIFECYCLE_STATES.DESTROYED);
    assert.equal(destroyEvents, 1);
  });

  contractTest("all instance operations reject use after destroy", async () => {
    const instance = await createInstance();
    instance.destroy();

    for (const operation of [
      () => instance.getSnapshot(),
      () => instance.getSelection(),
      () => instance.getCapabilities(),
      () => instance.on("ready", () => {}),
      () => instance.resize(),
    ]) {
      assert.throws(operation, expectCode(ERROR_CODES.INSTANCE_DESTROYED));
    }
    for (const operation of [
      () => instance.load(snapshotWithSheetOrder()),
      () =>
        instance.setCellValue(
          { sheetId: "details", row: 0, column: 0 },
          { value: "x" }
        ),
      () => instance.execute({ type: COMMAND_TYPES.UNDO }),
      () => instance.undo(),
      () => instance.redo(),
    ]) {
      await assert.rejects(
        operation,
        expectCode(ERROR_CODES.INSTANCE_DESTROYED)
      );
    }
  });

  contractTest("snapshots are isolated JSON copies", async () => {
    const source = snapshotWithSheetOrder();
    const instance = await create(createHost(), { snapshot: source });
    source.workbook.sheets[0].name = "outside-before-read";
    assert.equal(instance.getSnapshot().workbook.sheets[0].name, "费用明细");

    const firstRead = instance.getSnapshot();
    firstRead.workbook.sheets[0].name = "outside-after-read";
    firstRead.extensions.changed = true;
    const secondRead = instance.getSnapshot();
    assert.equal(secondRead.workbook.sheets[0].name, "费用明细");
    assert.equal(secondRead.extensions.changed, undefined);
    assert.doesNotThrow(() => JSON.stringify(secondRead));
    instance.destroy();
  });

  contractTest("invalid snapshot load is atomic", async () => {
    const instance = await createInstance();
    const before = instance.getSnapshot();
    await assert.rejects(
      () =>
        instance.load({
          schemaVersion: 1,
          dataFormat: "luckysheet",
          workbook: { sheets: "invalid" },
          extensions: {},
        }),
      expectCode(ERROR_CODES.INVALID_SNAPSHOT)
    );
    const withFunction = snapshotWithSheetOrder();
    withFunction.extensions.invalid = () => "not JSON";
    await assert.rejects(
      () => instance.load(withFunction),
      expectCode(ERROR_CODES.INVALID_SNAPSHOT)
    );
    assert.deepEqual(instance.getSnapshot(), before);
    instance.destroy();
  });

  contractTest(
    "unknown snapshot versions are rejected explicitly",
    async () => {
      const instance = await createInstance();
      await assert.rejects(
        () => instance.load({ ...snapshotWithSheetOrder(), schemaVersion: 2 }),
        expectCode(ERROR_CODES.UNSUPPORTED_SNAPSHOT_VERSION)
      );
      instance.destroy();
    }
  );

  contractTest(
    "unknown commands fail instead of reporting success",
    async () => {
      const instance = await createInstance();
      await assert.rejects(
        () => instance.execute({ type: "sheet.teleport-cell" }),
        expectCode(ERROR_CODES.UNSUPPORTED_COMMAND)
      );
      instance.destroy();
    }
  );

  contractTest("readonly rejects every workbook mutation command", async () => {
    const instance = await createInstance({ readonly: true });
    const operations = [
      () =>
        instance.setCellValue(
          { sheetId: "details", row: 1, column: 2 },
          { value: 200 }
        ),
      () =>
        instance.execute({
          type: COMMAND_TYPES.SET_FORMAT,
          sheetId: "details",
          ranges: [{ startRow: 1, endRow: 1, startColumn: 2, endColumn: 2 }],
          patch: { bold: true },
        }),
      () => instance.undo(),
      () => instance.redo(),
    ];
    for (const operation of operations) {
      await assert.rejects(operation, expectCode(ERROR_CODES.READONLY));
    }
    assert.doesNotThrow(() => instance.getSnapshot());
    await assert.doesNotReject(() => instance.load(snapshotWithSheetOrder()));
    instance.destroy();
  });

  contractTest(
    "setCellValue maps to the command and keeps formula input explicit",
    async () => {
      const instance = await createInstance();
      const events = [];
      instance.on("workbook-change", event => events.push(event));

      await instance.setCellValue(
        { sheetId: "details", row: 0, column: 0 },
        { value: "=ABC" }
      );
      let cell = findCell(instance.getSnapshot(), "details", 0, 0);
      assert.equal(cell.v, "=ABC");
      assert.equal(cell.f, undefined);

      await instance.setCellValue(
        { sheetId: "details", row: 0, column: 1 },
        { formula: "=SUM(C2:C3)" }
      );
      cell = findCell(instance.getSnapshot(), "details", 0, 1);
      assert.equal(cell.f, "=SUM(C2:C3)");
      assert.equal(cell.v, null);
      assert.equal(events.length, 2);
      assert.equal(events[0].commandType, COMMAND_TYPES.SET_CELL_VALUE);
      instance.destroy();
    }
  );

  contractTest(
    "sheetId stays stable when worksheet order changes",
    async () => {
      const instance = await create(createHost(), {
        snapshot: snapshotWithSheetOrder(["summary", "details"]),
      });
      await instance.setCellValue(
        { sheetId: "details", row: 1, column: 2 },
        { value: 250 }
      );
      const snapshot = instance.getSnapshot();
      assert.equal(findCell(snapshot, "details", 1, 2).v, 250);
      assert.equal(findCell(snapshot, "summary", 0, 0).v, "总费用");
      instance.destroy();
    }
  );

  contractTest(
    "set-format implements bold and rejects unsupported patches",
    async () => {
      const instance = await createInstance();
      await instance.execute({
        type: COMMAND_TYPES.SET_FORMAT,
        sheetId: "details",
        ranges: [{ startRow: 1, endRow: 1, startColumn: 2, endColumn: 2 }],
        patch: { bold: true },
      });
      assert.equal(findCell(instance.getSnapshot(), "details", 1, 2).bl, 1);
      await assert.rejects(
        () =>
          instance.execute({
            type: COMMAND_TYPES.SET_FORMAT,
            sheetId: "details",
            ranges: [{ startRow: 1, endRow: 1, startColumn: 2, endColumn: 2 }],
            patch: { italic: true },
          }),
        expectCode(ERROR_CODES.UNSUPPORTED_COMMAND)
      );
      instance.destroy();
    }
  );

  contractTest("undo means undo and redo means redo", async () => {
    const instance = await createInstance();
    const target = { sheetId: "details", row: 1, column: 2 };
    await instance.setCellValue(target, { value: 300 });
    assert.equal(findCell(instance.getSnapshot(), "details", 1, 2).v, 300);
    await instance.undo();
    assert.equal(findCell(instance.getSnapshot(), "details", 1, 2).v, 100);
    await instance.redo();
    assert.equal(findCell(instance.getSnapshot(), "details", 1, 2).v, 300);
    instance.destroy();
  });

  contractTest("capabilities distinguish supported from enabled", async () => {
    const instance = await createInstance();
    let capabilities = instance.getCapabilities();
    assert.deepEqual(capabilities[CAPABILITY_IDS.SET_CELL_VALUE], {
      supported: true,
      enabled: true,
    });
    assert.equal(capabilities[CAPABILITY_IDS.BOLD].supported, true);
    assert.equal(capabilities[CAPABILITY_IDS.UNDO].supported, true);
    assert.equal(capabilities[CAPABILITY_IDS.UNDO].enabled, false);
    assert.equal(
      capabilities[CAPABILITY_IDS.UNDO].reasonCode,
      "NO_UNDO_HISTORY"
    );
    assert.equal(capabilities["sheet.insert-row"], undefined);

    await instance.setCellValue(
      { sheetId: "details", row: 1, column: 2 },
      { value: 400 }
    );
    capabilities = instance.getCapabilities();
    assert.equal(capabilities[CAPABILITY_IDS.UNDO].enabled, true);
    await instance.undo();
    capabilities = instance.getCapabilities();
    assert.equal(capabilities[CAPABILITY_IDS.REDO].enabled, true);
    instance.destroy();
  });

  contractTest("selection DTO is isolated from caller mutation", async () => {
    const instance = await createInstance();
    const selection = instance.getSelection();
    assert.deepEqual(selection, {
      sheetId: "details",
      ranges: [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 }],
    });
    selection.sheetId = "summary";
    selection.ranges[0].endRow = 99;
    assert.deepEqual(instance.getSelection(), {
      sheetId: "details",
      ranges: [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 }],
    });
    instance.destroy();
  });

  contractTest(
    "event unsubscribe is idempotent and stops delivery",
    async () => {
      const instance = await createInstance();
      let eventCount = 0;
      const unsubscribe = instance.on("workbook-change", event => {
        eventCount += 1;
        assert.equal(event.type, "workbook-change");
        assert.equal(Object.isFrozen(event), true);
      });
      await instance.setCellValue(
        { sheetId: "details", row: 1, column: 2 },
        { value: 500 }
      );
      unsubscribe();
      unsubscribe();
      await instance.setCellValue(
        { sheetId: "details", row: 1, column: 2 },
        { value: 600 }
      );
      assert.equal(eventCount, 1);
      instance.destroy();
    }
  );

  contractTest(
    "listener errors do not roll back committed commands",
    async () => {
      const instance = await createInstance();
      instance.on("workbook-change", () => {
        throw new Error("expected listener failure");
      });
      await assert.doesNotReject(() =>
        instance.setCellValue(
          { sheetId: "details", row: 1, column: 2 },
          { value: 550 }
        )
      );
      assert.equal(findCell(instance.getSnapshot(), "details", 1, 2).v, 550);
      instance.destroy();
    }
  );

  contractTest("invalid arguments fail with stable errors", async () => {
    await assert.rejects(
      () => create(null, { snapshot: snapshotWithSheetOrder() }),
      expectCode(ERROR_CODES.INVALID_ARGUMENT)
    );
    const instance = await createInstance();
    await assert.rejects(
      () =>
        instance.setCellValue(
          { sheetId: "details", row: -1, column: 0 },
          { value: "x" }
        ),
      expectCode(ERROR_CODES.INVALID_ARGUMENT)
    );
    await assert.rejects(
      () =>
        instance.setCellValue(
          { sheetId: "missing", row: 0, column: 0 },
          { value: "x" }
        ),
      expectCode(ERROR_CODES.INVALID_ARGUMENT)
    );
    await assert.rejects(
      () =>
        instance.setCellValue(
          { sheetId: "details", row: 0, column: 0 },
          { value: "x", formula: "=A1" }
        ),
      expectCode(ERROR_CODES.INVALID_ARGUMENT)
    );
    await assert.rejects(
      () =>
        instance.setCellValue(
          { sheetId: "details", row: 0, column: 0 },
          { formula: "SUM(A1:A2)" }
        ),
      expectCode(ERROR_CODES.INVALID_ARGUMENT)
    );
    instance.destroy();
  });
}

export { snapshotWithSheetOrder };
