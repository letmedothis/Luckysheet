/**
 * Phase 1 public Spreadsheet SDK contract.
 *
 * All row and column indexes are zero-based. Range end positions are inclusive.
 * Public callers address worksheets by stable `sheetId`, never by active sheet or
 * array order. The legacy bridge is responsible for translating that ID.
 *
 * @typedef {"creating" | "ready" | "destroyed"} SpreadsheetLifecycleState
 *
 * @typedef {Object} SpreadsheetSnapshot
 * @property {1} schemaVersion
 * @property {"luckysheet"} dataFormat Compatibility marker, not a Ledger model.
 * @property {{sheets: Array<Record<string, unknown>>}} workbook
 * @property {Record<string, unknown>} extensions
 *
 * @typedef {Object} CellTarget
 * @property {string} sheetId Stable worksheet identity.
 * @property {number} row
 * @property {number} column
 *
 * @typedef {{value: string | number | boolean | null} | {formula: string}} CellInput
 * Plain strings always mean literal values, including strings beginning with `=`.
 * Formulas must use the explicit `{formula}` form.
 *
 * @typedef {Object} SpreadsheetRange
 * @property {number} startRow
 * @property {number} endRow Inclusive.
 * @property {number} startColumn
 * @property {number} endColumn Inclusive.
 *
 * @typedef {Object} SpreadsheetSelection
 * @property {string} sheetId
 * @property {SpreadsheetRange[]} ranges
 *
 * @typedef {Object} CapabilityState
 * @property {boolean} supported Whether the SDK implementation provides it.
 * @property {boolean} enabled Whether it can execute in the current state.
 * @property {string=} reasonCode Stable reason when disabled.
 *
 * @typedef {Object} CommandResult
 * @property {string} commandId
 * @property {number} revision Monotonic in-memory document operation revision.
 * @property {Array<{sheetId: string, range: SpreadsheetRange}>} affectedRanges
 *
 * @typedef {Object} CreateSpreadsheetOptions
 * @property {boolean=} readonly
 * @property {SpreadsheetSnapshot=} snapshot
 *
 * @typedef {Object} SpreadsheetInstance
 * @property {SpreadsheetLifecycleState} state
 * @property {() => void} destroy Synchronous and idempotent.
 * @property {(snapshot: SpreadsheetSnapshot) => Promise<void>} load
 * @property {() => SpreadsheetSnapshot} getSnapshot
 * @property {(target: CellTarget, value: CellInput) => Promise<CommandResult>} setCellValue
 * @property {(command: SpreadsheetCommand) => Promise<CommandResult | void>} execute
 * @property {() => Promise<CommandResult>} undo
 * @property {() => Promise<CommandResult>} redo
 * @property {() => SpreadsheetSelection} getSelection
 * @property {() => Record<string, CapabilityState>} getCapabilities
 * @property {(event: SpreadsheetEventName, listener: (payload: unknown) => void) => () => void} on
 * @property {() => void} resize
 *
 * @typedef {
 *   | {type: "sheet.set-cell-value", target: CellTarget, value: CellInput}
 *   | {type: "sheet.set-format", sheetId: string, ranges: SpreadsheetRange[], patch: {bold: boolean}}
 *   | {type: "workbook.undo"}
 *   | {type: "workbook.redo"}
 *   | {type: string, [key: string]: unknown}
 * } SpreadsheetCommand
 *
 * @typedef {"ready" | "selection-change" | "history-change" | "capabilities-change" | "workbook-change" | "destroy"} SpreadsheetEventName
 *
 * @typedef {{type: "ready", state: "ready"}} ReadyEvent
 * @typedef {{type: "selection-change", selection: SpreadsheetSelection}} SelectionChangeEvent
 * @typedef {{type: "history-change", canUndo: boolean, canRedo: boolean}} HistoryChangeEvent
 * @typedef {{type: "capabilities-change", capabilities: Record<string, CapabilityState>}} CapabilitiesChangeEvent
 * @typedef {{type: "workbook-change", source: "command" | "undo" | "redo" | "load", commandType: string | null, revision: number, affectedRanges: CommandResult["affectedRanges"]}} WorkbookChangeEvent
 * @typedef {{type: "destroy", state: "destroyed"}} DestroyEvent
 *
 * Events contain frozen JSON DTO copies. They never contain DOM nodes, Store,
 * controllers, or mutable runtime objects. Listener failures do not roll back a
 * committed command and do not prevent delivery to other listeners.
 */

export const SNAPSHOT_SCHEMA_VERSION = 1;
export const SNAPSHOT_DATA_FORMAT = "luckysheet";

export const LIFECYCLE_STATES = Object.freeze({
  CREATING: "creating",
  READY: "ready",
  DESTROYED: "destroyed",
});

export const COMMAND_TYPES = Object.freeze({
  SET_CELL_VALUE: "sheet.set-cell-value",
  SET_FORMAT: "sheet.set-format",
  UNDO: "workbook.undo",
  REDO: "workbook.redo",
});

export const CAPABILITY_IDS = Object.freeze({
  SET_CELL_VALUE: "sheet.set-cell-value",
  BOLD: "sheet.set-format.bold",
  UNDO: "workbook.undo",
  REDO: "workbook.redo",
});

export const EVENT_NAMES = Object.freeze([
  "ready",
  "selection-change",
  "history-change",
  "capabilities-change",
  "workbook-change",
  "destroy",
]);

export const ERROR_CODES = Object.freeze({
  INSTANCE_DESTROYED: "INSTANCE_DESTROYED",
  INVALID_ARGUMENT: "INVALID_ARGUMENT",
  INVALID_SNAPSHOT: "INVALID_SNAPSHOT",
  UNSUPPORTED_SNAPSHOT_VERSION: "UNSUPPORTED_SNAPSHOT_VERSION",
  UNSUPPORTED_COMMAND: "UNSUPPORTED_COMMAND",
  COMMAND_DISABLED: "COMMAND_DISABLED",
  READONLY: "READONLY",
  NOT_READY: "NOT_READY",
  CREATE_FAILED: "CREATE_FAILED",
});
