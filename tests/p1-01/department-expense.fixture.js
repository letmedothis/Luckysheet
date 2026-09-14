(function (global) {
  "use strict";

  const generalText = { fa: "General", t: "g" };
  const generalNumber = { fa: "General", t: "n" };

  function cell(value, type) {
    return {
      v: value,
      m: String(value),
      ct: type === "number" ? generalNumber : generalText,
    };
  }

  function formulaCell(formula, value) {
    return {
      f: formula,
      v: value,
      m: String(value),
      ct: generalNumber,
    };
  }

  function formulaChain(row, column, index, formula, value) {
    return {
      r: row,
      c: column,
      index,
      func: [true, value, formula],
      color: "w",
      parent: null,
      chidren: {},
      times: 0,
    };
  }

  const detailsIndex = "p1-expense-details";
  const summaryIndex = "p1-expense-summary";

  const workbook = [
    {
      name: "费用明细",
      index: detailsIndex,
      order: 0,
      status: 1,
      row: 20,
      column: 8,
      config: {},
      celldata: [
        { r: 0, c: 0, v: cell("日期") },
        { r: 0, c: 1, v: cell("类别") },
        { r: 0, c: 2, v: cell("金额") },
        { r: 1, c: 0, v: cell("2026-09-01") },
        { r: 1, c: 1, v: cell("交通费") },
        { r: 1, c: 2, v: cell(100, "number") },
        { r: 2, c: 0, v: cell("2026-09-02") },
        { r: 2, c: 1, v: cell("餐费") },
        { r: 2, c: 2, v: cell(200, "number") },
        { r: 3, c: 2, v: formulaCell("=SUM(C2:C3)", 300) },
      ],
      calcChain: [formulaChain(3, 2, detailsIndex, "=SUM(C2:C3)", 300)],
    },
    {
      name: "汇总",
      index: summaryIndex,
      order: 1,
      status: 0,
      row: 20,
      column: 8,
      config: {},
      celldata: [
        { r: 0, c: 0, v: cell("总费用") },
        {
          r: 0,
          c: 1,
          v: formulaCell("='费用明细'!C4", 300),
        },
      ],
      calcChain: [formulaChain(0, 1, summaryIndex, "='费用明细'!C4", 300)],
    },
  ];

  global.p101DepartmentExpenseFixture = Object.freeze({
    id: "department-monthly-expense-2026-09",
    description: "P1-01 固定双 Sheet 部门月度费用台账",
    sheetIndexes: Object.freeze({
      details: detailsIndex,
      summary: summaryIndex,
    }),
    createWorkbook: function () {
      return JSON.parse(JSON.stringify(workbook));
    },
  });
})(window);
