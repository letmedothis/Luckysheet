import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ERROR_CODES,
  createFakeSpreadsheet,
  createSpreadsheet,
} from "../../packages/sdk/index.mjs";
import { defineSpreadsheetContractSuite } from "./spreadsheet-contract-suite.mjs";

defineSpreadsheetContractSuite({
  implementationName: "FakeSpreadsheetInstance",
  create: createFakeSpreadsheet,
});

test("production createSpreadsheet fails explicitly until P1-05 installs a runtime", async () => {
  await assert.rejects(
    () => createSpreadsheet({}, {}),
    error =>
      error &&
      error.code === ERROR_CODES.CREATE_FAILED &&
      error.details?.implementationResponsibility === "P1-05"
  );
});
