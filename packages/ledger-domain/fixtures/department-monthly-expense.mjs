import { validateLedgerDefinitionVersion } from "../validation.mjs";

const GENERAL_TEXT = Object.freeze({ fa: "General", t: "g" });
const GENERAL_NUMBER = Object.freeze({ fa: "General", t: "n" });

function cell(value, type = "text") {
  return {
    v: value,
    m: String(value),
    ct: type === "number" ? GENERAL_NUMBER : GENERAL_TEXT,
  };
}

function formulaCell(formula, value) {
  return {
    f: formula,
    v: value,
    m: String(value),
    ct: GENERAL_NUMBER,
  };
}

function formulaChain(row, column, sheetId, formula, value) {
  return {
    r: row,
    c: column,
    index: sheetId,
    func: [true, value, formula],
    color: "w",
    parent: null,
    chidren: {},
    times: 0,
  };
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export const DEPARTMENT_EXPENSE_SHEET_IDS = Object.freeze({
  DETAILS: "department-expense-details",
  SUMMARY: "department-expense-summary",
});

const detailsSheetId = DEPARTMENT_EXPENSE_SHEET_IDS.DETAILS;
const summarySheetId = DEPARTMENT_EXPENSE_SHEET_IDS.SUMMARY;

/** @type {import("../contracts.mjs").LedgerDefinitionVersion} */
export const DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1 = deepFreeze({
  id: "department-monthly-expense-v1",
  code: "department-monthly-expense",
  name: "部门月度费用台账",
  version: 1,
  templateSnapshot: {
    schemaVersion: 1,
    dataFormat: "luckysheet",
    workbook: {
      sheets: [
        {
          sheetId: detailsSheetId,
          index: detailsSheetId,
          name: "费用明细",
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
          calcChain: [formulaChain(3, 2, detailsSheetId, "=SUM(C2:C3)", 300)],
        },
        {
          sheetId: summarySheetId,
          index: summarySheetId,
          name: "汇总",
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
          calcChain: [
            formulaChain(0, 1, summarySheetId, "='费用明细'!C4", 300),
          ],
        },
      ],
    },
    extensions: {},
  },
});

validateLedgerDefinitionVersion(DEPARTMENT_MONTHLY_EXPENSE_DEFINITION_V1);
