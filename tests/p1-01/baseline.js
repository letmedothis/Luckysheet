(function (global) {
  "use strict";

  const PASS = "PASS";
  const KNOWN_FAILURE = "KNOWN FAILURE";
  const NOT_COVERED = "NOT COVERED";
  const fixture = global.p101DepartmentExpenseFixture;
  const instrumentation = global.p101Instrumentation;
  const results = [];
  const diagnostics = {
    consoleErrors: [],
    uncaughtErrors: [],
  };

  const originalConsoleError = console.error.bind(console);
  console.error = function () {
    diagnostics.consoleErrors.push(
      Array.prototype.map.call(arguments, String).join(" ")
    );
    originalConsoleError.apply(console, arguments);
  };
  global.addEventListener("error", function (event) {
    diagnostics.uncaughtErrors.push(event.message || String(event.error));
  });
  global.addEventListener("unhandledrejection", function (event) {
    diagnostics.uncaughtErrors.push(String(event.reason));
  });

  function wait(milliseconds) {
    return new Promise(function (resolve) {
      setTimeout(resolve, milliseconds);
    });
  }

  async function waitFor(predicate, timeout) {
    const start = performance.now();
    while (performance.now() - start < timeout) {
      if (predicate()) return true;
      await wait(20);
    }
    return false;
  }

  function add(id, status, actual, expected, note) {
    results.push({ id, status, actual, expected, note: note || null });
  }

  function equalNumber(value, expected) {
    return Number(value) === expected;
  }

  function read(row, column, order, type) {
    try {
      return global.luckysheet.getCellValue(row, column, {
        order,
        type: type || "v",
      });
    } catch (error) {
      return (
        "READ_ERROR: " +
        (error && error.message ? error.message : String(error))
      );
    }
  }

  function luckysheetBodyNodes() {
    const matching = Array.prototype.filter.call(
      document.body.children,
      function (node) {
        return (
          /^luckysheet/.test(node.id || "") ||
          /(^|\s)luckysheet-/.test(
            typeof node.className === "string" ? node.className : ""
          )
        );
      }
    );
    return {
      count: matching.length,
      roots: matching.map(function (node) {
        return {
          tag: node.tagName.toLowerCase(),
          id: node.id || null,
          className: typeof node.className === "string" ? node.className : null,
          inContainer: !!node.closest("#luckysheet"),
        };
      }),
    };
  }

  function hasListenerGrowth(before, after) {
    return Object.keys(after).some(function (key) {
      return after[key] > (before[key] || 0);
    });
  }

  function remoteCalls() {
    const localOrigin = location.origin;
    const calls = instrumentation.calls.slice();
    performance.getEntriesByType("resource").forEach(function (entry) {
      calls.push({
        kind: "performance-resource",
        url: entry.name,
        detail: null,
      });
    });
    return calls.filter(function (call) {
      try {
        const url = new URL(call.url, location.href);
        return (
          url.protocol === "ws:" ||
          url.protocol === "wss:" ||
          url.origin !== localOrigin
        );
      } catch (_error) {
        return true;
      }
    });
  }

  function output(payload) {
    const pre = document.createElement("pre");
    pre.id = "p1-01-result";
    pre.setAttribute("data-complete", "true");
    pre.textContent = JSON.stringify(payload, null, 2);
    document.body.innerHTML = "";
    document.body.appendChild(pre);
    document.title = "P1-01 COMPLETE";
  }

  async function run() {
    const before = {
      listeners: instrumentation.listenerSummary(),
      jqueryDocumentEvents: instrumentation.jqueryEventSummary(document),
      jqueryWindowEvents: instrumentation.jqueryEventSummary(global),
      timers: instrumentation.activeTimers(),
      bodyNodes: luckysheetBodyNodes(),
    };
    let createHookPayload = null;
    let createError = null;

    try {
      global.luckysheet.create({
        container: "luckysheet",
        lang: "zh",
        title: "P1-01 部门月度费用台账",
        data: fixture.createWorkbook(),
        loadUrl: "",
        updateUrl: "",
        plugins: [],
        userInfo: false,
        showinfobar: false,
        forceCalculation: true,
        hook: {
          workbookCreateAfter: function (workbook) {
            createHookPayload = workbook;
          },
        },
      });
    } catch (error) {
      createError = error && error.stack ? error.stack : String(error);
    }

    const created = await waitFor(function () {
      return !!document.querySelector("#luckysheet-grid-window-1");
    }, 3000);
    await wait(100);
    add(
      "create",
      created && !createError ? PASS : KNOWN_FAILURE,
      { created, createError, hookCalled: !!createHookPayload },
      { created: true, createError: null },
      "workbookCreateAfter 是否触发单独记录，不作为 create DOM 成功的必要条件。"
    );

    if (!created || createError) {
      [
        "edit",
        "formula",
        "cross-sheet-formula",
        "undo",
        "redo",
        "bold",
        "snapshot",
      ].forEach(function (id) {
        add(id, NOT_COVERED, null, null, "create 未成功，后续能力无法执行。");
      });
    } else {
      const initial = { detailFormula: read(3, 2, 0) };
      add(
        "formula",
        equalNumber(initial.detailFormula, 300) ? PASS : KNOWN_FAILURE,
        initial.detailFormula,
        300,
        "费用明细 C4 = SUM(C2:C3)。"
      );
      global.luckysheet.setSheetActive(1);
      await wait(100);
      initial.summaryFormula = read(0, 1, 1);
      add(
        "cross-sheet-formula",
        equalNumber(initial.summaryFormula, 300) ? PASS : KNOWN_FAILURE,
        initial.summaryFormula,
        300,
        "非活动 Sheet 的 data 初始未构建；先通过现有 setSheetActive 激活汇总，再读取 B1。"
      );
      global.luckysheet.setSheetActive(0);
      await wait(100);

      global.luckysheet.setCellValue(1, 2, 150, { order: 0 });
      await wait(100);
      const afterEdit = {
        value: read(1, 2, 0),
        detailFormula: read(3, 2, 0),
        summaryFormula: read(0, 1, 1),
      };
      add(
        "edit",
        equalNumber(afterEdit.value, 150) &&
          equalNumber(afterEdit.detailFormula, 350) &&
          equalNumber(afterEdit.summaryFormula, 350)
          ? PASS
          : KNOWN_FAILURE,
        afterEdit,
        { value: 150, detailFormula: 350, summaryFormula: 350 },
        "通过现有公开 setCellValue 验证引擎编辑；真实键盘/IME 输入本任务未自动化。"
      );
      add(
        "edit-keyboard-ime",
        NOT_COVERED,
        null,
        null,
        "最小无依赖 headless harness 未注入受信任键盘/IME 事件。"
      );

      global.luckysheet.undo();
      await wait(100);
      const afterUndo = {
        value: read(1, 2, 0),
        detailFormula: read(3, 2, 0),
        summaryFormula: read(0, 1, 1),
      };
      add(
        "undo",
        equalNumber(afterUndo.value, 100) &&
          equalNumber(afterUndo.detailFormula, 300) &&
          equalNumber(afterUndo.summaryFormula, 300)
          ? PASS
          : KNOWN_FAILURE,
        afterUndo,
        { value: 100, detailFormula: 300, summaryFormula: 300 }
      );

      global.luckysheet.redo();
      await wait(100);
      const afterRedo = {
        value: read(1, 2, 0),
        detailFormula: read(3, 2, 0),
        summaryFormula: read(0, 1, 1),
      };
      add(
        "redo",
        equalNumber(afterRedo.value, 150) &&
          equalNumber(afterRedo.detailFormula, 350) &&
          equalNumber(afterRedo.summaryFormula, 350)
          ? PASS
          : KNOWN_FAILURE,
        afterRedo,
        { value: 150, detailFormula: 350, summaryFormula: 350 }
      );

      global.luckysheet.setCellFormat(1, 1, "bl", 1, { order: 0 });
      await wait(100);
      const boldCell = global.luckysheet.getAllSheets()[0].data[1][1];
      add(
        "bold",
        boldCell && boldCell.bl === 1 ? PASS : KNOWN_FAILURE,
        boldCell && boldCell.bl,
        1
      );

      let snapshot = null;
      let snapshotError = null;
      try {
        snapshot = global.luckysheet.toJson();
      } catch (error) {
        snapshotError = error && error.stack ? error.stack : String(error);
      }
      const snapshotSummary = snapshot
        ? {
            topLevelKeys: Object.keys(snapshot).sort(),
            sheetCount: Array.isArray(snapshot.data)
              ? snapshot.data.length
              : null,
            sheets: (snapshot.data || []).map(function (sheet) {
              return {
                name: sheet.name,
                index: sheet.index,
                row: sheet.row,
                column: sheet.column,
                hasData: Array.isArray(sheet.data),
                dataRows: Array.isArray(sheet.data) ? sheet.data.length : null,
                celldataCount: Array.isArray(sheet.celldata)
                  ? sheet.celldata.length
                  : null,
                calcChainCount: Array.isArray(sheet.calcChain)
                  ? sheet.calcChain.length
                  : null,
              };
            }),
          }
        : null;
      add(
        "snapshot",
        snapshot && snapshot.data && snapshot.data.length === 2
          ? PASS
          : KNOWN_FAILURE,
        { snapshotError, summary: snapshotSummary },
        { sheetCount: 2 }
      );
    }

    const afterOperations = {
      listeners: instrumentation.listenerSummary(),
      jqueryDocumentEvents: instrumentation.jqueryEventSummary(document),
      jqueryWindowEvents: instrumentation.jqueryEventSummary(global),
      timers: instrumentation.activeTimers(),
      bodyNodes: luckysheetBodyNodes(),
    };

    let destroyError = null;
    try {
      global.luckysheet.destroy();
    } catch (error) {
      destroyError = error && error.stack ? error.stack : String(error);
    }
    await wait(0);
    const afterDestroySync = {
      containerChildCount:
        document.getElementById("luckysheet").childNodes.length,
      bodyNodes: luckysheetBodyNodes(),
      listeners: instrumentation.listenerSummary(),
      jqueryDocumentEvents: instrumentation.jqueryEventSummary(document),
      jqueryWindowEvents: instrumentation.jqueryEventSummary(global),
      timers: instrumentation.activeTimers(),
      globalLuckysheetPresent: !!global.luckysheet,
    };
    instrumentation.resetMutationCount();
    await wait(350);
    const afterDestroySettled = {
      containerChildCount:
        document.getElementById("luckysheet").childNodes.length,
      bodyNodes: luckysheetBodyNodes(),
      listeners: instrumentation.listenerSummary(),
      jqueryDocumentEvents: instrumentation.jqueryEventSummary(document),
      jqueryWindowEvents: instrumentation.jqueryEventSummary(global),
      timers: instrumentation.activeTimers(),
      globalLuckysheetPresent: !!global.luckysheet,
      asynchronousMutationCount: instrumentation.mutationCount(),
    };
    instrumentation.resetMutationCount();
    await wait(10200);
    const afterDestroyDelayedCallbacks = {
      timers: instrumentation.activeTimers(),
      bodyNodes: luckysheetBodyNodes(),
      asynchronousMutationCount: instrumentation.mutationCount(),
    };
    const destroyResidual = {
      listenerGrowth: hasListenerGrowth(
        before.listeners,
        afterDestroySettled.listeners
      ),
      activeTimeouts: afterDestroySettled.timers.timeouts.length,
      activeIntervals: afterDestroySettled.timers.intervals.length,
      bodyRootsOutsideContainer: afterDestroySettled.bodyNodes.roots.filter(
        function (node) {
          return !node.inContainer;
        }
      ).length,
    };
    add(
      "destroy",
      !destroyError &&
        afterDestroySettled.containerChildCount === 0 &&
        !destroyResidual.listenerGrowth &&
        destroyResidual.activeTimeouts === 0 &&
        destroyResidual.activeIntervals === 0 &&
        destroyResidual.bodyRootsOutsideContainer === 0
        ? PASS
        : KNOWN_FAILURE,
      {
        destroyError,
        destroyResidual,
        afterDestroySync,
        afterDestroySettled,
        afterDestroyDelayedCallbacks,
      },
      {
        destroyError: null,
        containerChildCount: 0,
        listenerGrowth: false,
        activeTimeouts: 0,
        activeIntervals: 0,
        bodyRootsOutsideContainer: 0,
      },
      "容器清空与资源完全释放分别判断；残留作为 baseline 证据保留。"
    );

    const network = remoteCalls();
    add(
      "network",
      network.length === 0 ? PASS : KNOWN_FAILURE,
      network,
      [],
      "仅判定非当前本地 origin 的 fetch/XHR/WebSocket/动态资源与 Performance resource。"
    );

    output({
      schemaVersion: 1,
      fixture: {
        id: fixture.id,
        description: fixture.description,
        sheetIndexes: fixture.sheetIndexes,
      },
      environment: {
        userAgent: navigator.userAgent,
        location: location.href,
        devicePixelRatio: global.devicePixelRatio,
        viewport: { width: global.innerWidth, height: global.innerHeight },
      },
      results,
      lifecycle: { before, afterOperations },
      network,
      diagnostics,
    });
  }

  run().catch(function (error) {
    output({
      schemaVersion: 1,
      harnessFailure: error && error.stack ? error.stack : String(error),
      results,
      diagnostics,
    });
  });
})(window);
