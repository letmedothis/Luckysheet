import assert from "node:assert/strict";
import { test } from "node:test";

import { ERROR_CODES as SDK_ERROR_CODES } from "../../packages/sdk/index.mjs";
import {
  DEPARTMENT_EXPENSE_SHEET_IDS,
  DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1,
  INITIAL_LEDGER_REVISION,
  LEDGER_DOMAIN_ERROR_CODES,
  createLedgerCapabilities,
  createLedgerDraft,
  isLedgerDomainError,
  validateLedgerCapabilities,
  validateLedgerDefinitionVersion,
  validateLedgerDefinitionVersionSet,
  validateLedgerInstance,
  validateLedgerRevision,
} from "../../packages/ledger-domain/index.mjs";

const NOW = "2026-09-14T08:00:00.000Z";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function draftInput(overrides = {}) {
  return {
    definitionVersion: DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1,
    ledgerId: "ledger-expense-finance-2026-09",
    revisionId: "ledger-expense-finance-2026-09-r1",
    name: "财务部 2026-09 月度费用台账",
    department: "finance",
    period: "2026-09",
    createdBy: "user-001",
    now: NOW,
    ...overrides,
  };
}

function createDraft(overrides = {}) {
  return createLedgerDraft(draftInput(overrides));
}

test("fixed DefinitionVersion is valid, immutable, and contains the two-sheet fixture", () => {
  assert.equal(
    validateLedgerDefinitionVersion(DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1),
    DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1
  );
  assert.equal(Object.isFrozen(DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1), true);
  assert.equal(
    Object.isFrozen(
      DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1.templateSnapshot.workbook
        .sheets[0].celldata
    ),
    true
  );

  const sheets =
    DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1.templateSnapshot.workbook.sheets;
  assert.deepEqual(
    sheets.map(sheet => ({ sheetId: sheet.sheetId, name: sheet.name })),
    [
      {
        sheetId: DEPARTMENT_EXPENSE_SHEET_IDS.DETAILS,
        name: "费用明细",
      },
      { sheetId: DEPARTMENT_EXPENSE_SHEET_IDS.SUMMARY, name: "汇总" },
    ]
  );
  assert.equal(
    sheets[0].celldata.find(cell => cell.r === 3).v.f,
    "=SUM(C2:C3)"
  );
  assert.equal(sheets[1].celldata[1].v.f, "='费用明细'!C4");
});

test("invalid DefinitionVersion fields are rejected", () => {
  const cases = [
    { id: "" },
    { code: " " },
    { name: null },
    { version: 0 },
    { version: 1.5 },
    { fieldDefinitions: [] },
  ];
  cases.forEach(patch => {
    assert.throws(
      () =>
        validateLedgerDefinitionVersion({
          ...clone(DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1),
          ...patch,
        }),
      error =>
        isLedgerDomainError(
          error,
          LEDGER_DOMAIN_ERROR_CODES.INVALID_DOMAIN_OBJECT
        )
    );
  });
});

test("DefinitionVersion templateSnapshot uses the P1-02 snapshot validator", () => {
  const definition = clone(DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1);
  definition.templateSnapshot.schemaVersion = 99;
  assert.throws(
    () => validateLedgerDefinitionVersion(definition),
    error => error?.code === SDK_ERROR_CODES.UNSUPPORTED_SNAPSHOT_VERSION
  );
});

test("DefinitionVersion collection rejects duplicate IDs and code/version pairs", () => {
  const original = clone(DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1);
  const duplicateId = { ...clone(original), code: "another-code" };
  const duplicateVersion = { ...clone(original), id: "another-id" };

  assert.throws(() =>
    validateLedgerDefinitionVersionSet([original, duplicateId])
  );
  assert.throws(() =>
    validateLedgerDefinitionVersionSet([original, duplicateVersion])
  );
});

test("createLedgerDraft creates the minimal Ledger aggregate", () => {
  const { instance, revision } = createDraft();
  assert.deepEqual(instance, {
    id: "ledger-expense-finance-2026-09",
    definitionVersionId: "department-monthly-expense-v1",
    name: "财务部 2026-09 月度费用台账",
    department: "finance",
    period: "2026-09",
    status: "draft",
    headRevision: 1,
    createdAt: NOW,
    updatedAt: NOW,
  });
  assert.equal(revision.ledgerId, instance.id);
  assert.equal(revision.createdBy, "user-001");
});

test("initial LedgerRevision and headRevision both start at 1", () => {
  const { instance, revision } = createDraft();
  assert.equal(INITIAL_LEDGER_REVISION, 1);
  assert.equal(instance.headRevision, INITIAL_LEDGER_REVISION);
  assert.equal(revision.revision, INITIAL_LEDGER_REVISION);
});

test("revision snapshot is deeply isolated from the DefinitionVersion template", () => {
  const mutableDefinition = clone(DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1);
  const { revision } = createDraft({ definitionVersion: mutableDefinition });
  const templateCell =
    mutableDefinition.templateSnapshot.workbook.sheets[0].celldata[0].v;
  const revisionCell = revision.snapshot.workbook.sheets[0].celldata[0].v;

  assert.notEqual(revision.snapshot, mutableDefinition.templateSnapshot);
  assert.notEqual(revisionCell, templateCell);
  mutableDefinition.templateSnapshot.workbook.sheets[0].celldata[0].v.v =
    "模板已改";
  assert.equal(revisionCell.v, "日期");
  assert.throws(() => {
    revision.snapshot.workbook.sheets[0].celldata[0].v.v = "Revision 已改";
  }, TypeError);
  assert.equal(templateCell.v, "模板已改");
});

test("LedgerInstance keeps the DefinitionVersion ID used at creation", () => {
  const definition = clone(DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1);
  const { instance } = createDraft({ definitionVersion: definition });
  definition.id = "a-future-definition-version";
  assert.equal(instance.definitionVersionId, "department-monthly-expense-v1");
});

test("Phase 1 LedgerInstance accepts draft status only", () => {
  const { instance } = createDraft();
  for (const status of ["submitted", "in_review", "approved", "rejected"]) {
    assert.throws(() => validateLedgerInstance({ ...instance, status }));
  }
});

test("period accepts a valid YYYY-MM value", () => {
  const { instance } = createDraft({ period: "2026-09" });
  assert.equal(validateLedgerInstance(instance), instance);
});

test("period rejects invalid values", () => {
  const { instance } = createDraft();
  for (const period of ["2026-9", "2026-00", "2026-13", "09-2026", ""]) {
    assert.throws(() => validateLedgerInstance({ ...instance, period }));
  }
});

test("optional department and period may be omitted without undefined DTO fields", () => {
  const input = draftInput();
  delete input.department;
  delete input.period;
  const { instance } = createLedgerDraft(input);
  assert.equal(Object.hasOwn(instance, "department"), false);
  assert.equal(Object.hasOwn(instance, "period"), false);
  assert.equal(validateLedgerInstance(instance), instance);
});

test("LedgerInstance rejects headRevision below 1 or non-integer values", () => {
  const { instance } = createDraft();
  for (const headRevision of [0, -1, 1.5, "1"]) {
    assert.throws(() => validateLedgerInstance({ ...instance, headRevision }));
  }
});

test("LedgerRevision validates ownership against the expected ledgerId", () => {
  const { instance, revision } = createDraft();
  assert.equal(
    validateLedgerRevision(revision, { ledgerId: instance.id }),
    revision
  );
  assert.throws(
    () => validateLedgerRevision(revision, { ledgerId: "another-ledger" }),
    error =>
      isLedgerDomainError(
        error,
        LEDGER_DOMAIN_ERROR_CODES.INVALID_DOMAIN_OBJECT
      ) && error.details?.receivedLedgerId === instance.id
  );
});

test("LedgerRevision rejects revision numbers below 1 and invalid snapshots", () => {
  const { revision } = createDraft();
  assert.throws(() => validateLedgerRevision({ ...revision, revision: 0 }));
  assert.throws(
    () =>
      validateLedgerRevision({
        ...revision,
        snapshot: { ...revision.snapshot, dataFormat: "another-format" },
      }),
    error => error?.code === SDK_ERROR_CODES.INVALID_SNAPSHOT
  );
});

test("created Ledger records are immutable", () => {
  const { instance, revision } = createDraft();
  assert.equal(Object.isFrozen(instance), true);
  assert.equal(Object.isFrozen(revision), true);
  assert.equal(Object.isFrozen(revision.snapshot), true);
  assert.throws(() => {
    revision.revision = 2;
  }, TypeError);
});

test("LedgerCapabilities is an isolated immutable business DTO", () => {
  const input = { canView: true, canEdit: true, canSave: false };
  const capabilities = createLedgerCapabilities(input);
  input.canEdit = false;
  assert.deepEqual(capabilities, {
    canView: true,
    canEdit: true,
    canSave: false,
  });
  assert.equal(Object.isFrozen(capabilities), true);
  assert.equal(validateLedgerCapabilities(capabilities), capabilities);
});

test("LedgerCapabilities rejects missing, non-boolean, and extra fields", () => {
  assert.throws(() =>
    validateLedgerCapabilities({ canView: true, canEdit: true })
  );
  assert.throws(() =>
    validateLedgerCapabilities({
      canView: true,
      canEdit: "yes",
      canSave: true,
    })
  );
  assert.throws(() =>
    validateLedgerCapabilities({
      canView: true,
      canEdit: true,
      canSave: true,
      canCreate: true,
    })
  );
});

test("Spreadsheet command revision cannot enter Ledger draft input or headRevision", () => {
  assert.throws(
    () => createDraft({ commandRevision: 42 }),
    error =>
      isLedgerDomainError(
        error,
        LEDGER_DOMAIN_ERROR_CODES.INVALID_CREATE_DRAFT_ARGUMENT
      ) && error.details?.unknownKeys.includes("commandRevision")
  );

  const { instance, revision } = createDraft();
  assert.equal(instance.headRevision, 1);
  assert.equal(revision.revision, 1);
  assert.equal(Object.hasOwn(instance, "commandRevision"), false);
  assert.equal(Object.hasOwn(revision, "commandRevision"), false);
});
