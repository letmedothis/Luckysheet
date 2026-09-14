export {
  CAPABILITY_IDS,
  COMMAND_TYPES,
  ERROR_CODES,
  EVENT_NAMES,
  LIFECYCLE_STATES,
  SNAPSHOT_DATA_FORMAT,
  SNAPSHOT_SCHEMA_VERSION,
} from "./contracts.mjs";
export { SpreadsheetSdkError, isSpreadsheetSdkError } from "./errors.mjs";
export {
  cloneSpreadsheetSnapshot,
  getWorksheetSheetId,
  validateSpreadsheetSnapshot,
} from "./snapshot.mjs";
export {
  FakeSpreadsheetInstance,
  createFakeSpreadsheet,
} from "./fake-spreadsheet-instance.mjs";

import { ERROR_CODES } from "./contracts.mjs";
import { assertArgument, spreadsheetError } from "./errors.mjs";

/**
 * Stable production creator signature. P1-05 will connect this entry to the
 * Luckysheet Legacy Bridge. P1-02 fails explicitly instead of returning a Fake
 * from the production-named entry.
 *
 * @param {object} container
 * @param {import("./contracts.mjs").CreateSpreadsheetOptions} [options]
 * @returns {Promise<import("./contracts.mjs").SpreadsheetInstance>}
 */
export async function createSpreadsheet(container, options = {}) {
  assertArgument(
    container !== null &&
      (typeof container === "object" || typeof container === "function"),
    "Spreadsheet container must be an element-like object."
  );
  assertArgument(
    options !== null && typeof options === "object" && !Array.isArray(options),
    "Spreadsheet create options must be an object."
  );
  throw spreadsheetError(
    ERROR_CODES.CREATE_FAILED,
    "No Spreadsheet runtime adapter is installed. Use createFakeSpreadsheet for Product Shell development until P1-05 provides the Legacy Bridge.",
    { implementationResponsibility: "P1-05" }
  );
}
