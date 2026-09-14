import {
  CAPABILITY_IDS,
  COMMAND_TYPES,
  ERROR_CODES,
  EVENT_NAMES,
  LIFECYCLE_STATES,
} from "./contracts.mjs";
import { assertArgument, spreadsheetError } from "./errors.mjs";
import {
  cloneSpreadsheetSnapshot,
  getWorksheetSheetId,
  validateSpreadsheetSnapshot,
} from "./snapshot.mjs";

const DEFAULT_SNAPSHOT = Object.freeze({
  schemaVersion: 1,
  dataFormat: "luckysheet",
  workbook: {
    sheets: [{ index: "sheet-1", name: "Sheet1", celldata: [] }],
  },
  extensions: {},
});

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function freezeJson(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freezeJson);
  }
  return value;
}

function validateHost(host) {
  assertArgument(
    host !== null && (typeof host === "object" || typeof host === "function"),
    "Spreadsheet container must be an element-like object."
  );
}

function validateOptions(options) {
  assertArgument(
    options !== null && typeof options === "object" && !Array.isArray(options),
    "Spreadsheet create options must be an object."
  );
  if (options.readonly !== undefined) {
    assertArgument(
      typeof options.readonly === "boolean",
      "Spreadsheet readonly option must be a boolean."
    );
  }
}

function validateTarget(target) {
  assertArgument(
    target !== null && typeof target === "object" && !Array.isArray(target),
    "Cell target must be an object."
  );
  assertArgument(
    typeof target.sheetId === "string" && target.sheetId.length > 0,
    "Cell target sheetId must be a non-empty string."
  );
  assertArgument(
    Number.isInteger(target.row) && target.row >= 0,
    "Cell target row must be a non-negative integer."
  );
  assertArgument(
    Number.isInteger(target.column) && target.column >= 0,
    "Cell target column must be a non-negative integer."
  );
}

function validateCellInput(input) {
  assertArgument(
    input !== null && typeof input === "object" && !Array.isArray(input),
    "Cell input must be an object."
  );
  const hasValue = Object.prototype.hasOwnProperty.call(input, "value");
  const hasFormula = Object.prototype.hasOwnProperty.call(input, "formula");
  assertArgument(
    hasValue !== hasFormula,
    "Cell input must contain exactly one of value or formula."
  );
  if (hasFormula) {
    assertArgument(
      typeof input.formula === "string" &&
        input.formula.startsWith("=") &&
        input.formula.length > 1,
      "Formula input must be a non-empty string beginning with '='."
    );
    return;
  }
  const valueType = typeof input.value;
  assertArgument(
    input.value === null ||
      valueType === "string" ||
      valueType === "boolean" ||
      (valueType === "number" && Number.isFinite(input.value)),
    "Cell value must be a JSON scalar."
  );
}

function validateRange(range) {
  assertArgument(
    range !== null && typeof range === "object" && !Array.isArray(range),
    "Spreadsheet range must be an object."
  );
  for (const field of ["startRow", "endRow", "startColumn", "endColumn"]) {
    assertArgument(
      Number.isInteger(range[field]) && range[field] >= 0,
      `Spreadsheet range ${field} must be a non-negative integer.`
    );
  }
  assertArgument(
    range.startRow <= range.endRow && range.startColumn <= range.endColumn,
    "Spreadsheet range start must not be after its end."
  );
}

function findWorksheet(snapshot, sheetId) {
  const worksheet = snapshot.workbook.sheets.find(
    candidate => getWorksheetSheetId(candidate) === sheetId
  );
  assertArgument(worksheet, "Unknown worksheet sheetId.", { sheetId });
  return worksheet;
}

function findOrCreateCell(worksheet, row, column) {
  if (!Array.isArray(worksheet.celldata)) worksheet.celldata = [];
  let entry = worksheet.celldata.find(
    candidate => candidate.r === row && candidate.c === column
  );
  if (!entry) {
    entry = { r: row, c: column, v: {} };
    worksheet.celldata.push(entry);
  }
  if (!entry.v || typeof entry.v !== "object" || Array.isArray(entry.v)) {
    entry.v = {};
  }
  return entry.v;
}

function cellInputToLegacyCell(currentCell, input) {
  if (Object.prototype.hasOwnProperty.call(input, "formula")) {
    return {
      ...currentCell,
      f: input.formula,
      v: null,
      m: "",
    };
  }
  const value = input.value;
  const next = {
    ...currentCell,
    v: value,
    m: value === null ? "" : String(value),
  };
  delete next.f;
  return next;
}

function initialSelection(snapshot, requestedSelection) {
  const firstSheet = snapshot.workbook.sheets[0];
  const fallback = {
    sheetId: firstSheet ? getWorksheetSheetId(firstSheet) : "",
    ranges: firstSheet
      ? [{ startRow: 0, endRow: 0, startColumn: 0, endColumn: 0 }]
      : [],
  };
  const selection = requestedSelection ?? fallback;
  assertArgument(
    selection && typeof selection === "object" && !Array.isArray(selection),
    "Initial selection must be an object."
  );
  assertArgument(
    typeof selection.sheetId === "string",
    "Selection sheetId must be a string."
  );
  assertArgument(
    Array.isArray(selection.ranges),
    "Selection ranges must be an array."
  );
  selection.ranges.forEach(validateRange);
  if (selection.sheetId) findWorksheet(snapshot, selection.sheetId);
  return cloneJson(selection);
}

export class FakeSpreadsheetInstance {
  constructor(host, options) {
    this.state = LIFECYCLE_STATES.CREATING;
    this._host = host;
    this._readonly = options.readonly ?? false;
    this._snapshot = null;
    this._selection = null;
    this._undoStack = [];
    this._redoStack = [];
    this._revision = 0;
    this._commandSequence = 0;
    this._listenerErrors = [];
    this._listeners = new Map(EVENT_NAMES.map(name => [name, new Set()]));
  }

  static async create(host, options = {}) {
    validateHost(host);
    validateOptions(options);
    const instance = new FakeSpreadsheetInstance(host, options);
    try {
      const snapshot = options.snapshot ?? DEFAULT_SNAPSHOT;
      instance._snapshot = cloneSpreadsheetSnapshot(snapshot);
      instance._selection = initialSelection(
        instance._snapshot,
        options.initialSelection
      );
      instance.state = LIFECYCLE_STATES.READY;
      return instance;
    } catch (cause) {
      instance.state = LIFECYCLE_STATES.DESTROYED;
      throw spreadsheetError(
        ERROR_CODES.CREATE_FAILED,
        "Fake Spreadsheet instance creation failed.",
        { causeCode: cause && cause.code ? cause.code : undefined },
        cause
      );
    }
  }

  _assertReady() {
    if (this.state === LIFECYCLE_STATES.DESTROYED) {
      throw spreadsheetError(
        ERROR_CODES.INSTANCE_DESTROYED,
        "Spreadsheet instance has been destroyed."
      );
    }
    if (this.state !== LIFECYCLE_STATES.READY) {
      throw spreadsheetError(
        ERROR_CODES.NOT_READY,
        "Spreadsheet instance is not ready."
      );
    }
  }

  _assertMutable() {
    if (this._readonly) {
      throw spreadsheetError(
        ERROR_CODES.READONLY,
        "Spreadsheet instance is readonly."
      );
    }
  }

  _emit(name, payload) {
    const listeners = this._listeners.get(name);
    if (!listeners || listeners.size === 0) return;
    for (const listener of Array.from(listeners)) {
      try {
        listener(freezeJson(cloneJson(payload)));
      } catch (error) {
        this._listenerErrors.push(error);
      }
    }
  }

  _historyPayload() {
    return {
      type: "history-change",
      canUndo: this._undoStack.length > 0,
      canRedo: this._redoStack.length > 0,
    };
  }

  _emitHistoryAndCapabilities() {
    this._emit("history-change", this._historyPayload());
    this._emit("capabilities-change", {
      type: "capabilities-change",
      capabilities: this._capabilitiesWithoutGuard(),
    });
  }

  _capability(enabled, reasonCode) {
    return {
      supported: true,
      enabled,
      ...(enabled || !reasonCode ? {} : { reasonCode }),
    };
  }

  _capabilitiesWithoutGuard() {
    const mutable = !this._readonly;
    const mutationReason = mutable ? undefined : ERROR_CODES.READONLY;
    return {
      [CAPABILITY_IDS.SET_CELL_VALUE]: this._capability(
        mutable,
        mutationReason
      ),
      [CAPABILITY_IDS.BOLD]: this._capability(mutable, mutationReason),
      [CAPABILITY_IDS.UNDO]: this._capability(
        mutable && this._undoStack.length > 0,
        mutationReason ?? "NO_UNDO_HISTORY"
      ),
      [CAPABILITY_IDS.REDO]: this._capability(
        mutable && this._redoStack.length > 0,
        mutationReason ?? "NO_REDO_HISTORY"
      ),
    };
  }

  _nextResult(affectedRanges) {
    this._revision += 1;
    this._commandSequence += 1;
    return {
      commandId: `fake-command-${this._commandSequence}`,
      revision: this._revision,
      affectedRanges,
    };
  }

  _commit(commandType, mutate, affectedRanges) {
    const previous = cloneSpreadsheetSnapshot(this._snapshot);
    const next = cloneSpreadsheetSnapshot(this._snapshot);
    mutate(next);
    validateSpreadsheetSnapshot(next);
    this._undoStack.push(previous);
    this._redoStack = [];
    this._snapshot = next;
    const result = this._nextResult(affectedRanges);
    this._emit("workbook-change", {
      type: "workbook-change",
      source: "command",
      commandType,
      revision: result.revision,
      affectedRanges,
    });
    this._emitHistoryAndCapabilities();
    return result;
  }

  async load(snapshot) {
    this._assertReady();
    const next = cloneSpreadsheetSnapshot(snapshot);
    const nextSelection = initialSelection(next);
    this._snapshot = next;
    this._selection = nextSelection;
    this._undoStack = [];
    this._redoStack = [];
    this._revision += 1;
    this._emit("selection-change", {
      type: "selection-change",
      selection: this.getSelection(),
    });
    this._emit("workbook-change", {
      type: "workbook-change",
      source: "load",
      commandType: null,
      revision: this._revision,
      affectedRanges: [],
    });
    this._emitHistoryAndCapabilities();
  }

  getSnapshot() {
    this._assertReady();
    return cloneSpreadsheetSnapshot(this._snapshot);
  }

  setCellValue(target, value) {
    return this.execute({
      type: COMMAND_TYPES.SET_CELL_VALUE,
      target,
      value,
    });
  }

  async execute(command) {
    this._assertReady();
    assertArgument(
      command !== null &&
        typeof command === "object" &&
        !Array.isArray(command),
      "Spreadsheet command must be an object."
    );
    assertArgument(
      typeof command.type === "string" && command.type.length > 0,
      "Spreadsheet command type must be a non-empty string."
    );

    switch (command.type) {
      case COMMAND_TYPES.SET_CELL_VALUE:
        return this._executeSetCellValue(command);
      case COMMAND_TYPES.SET_FORMAT:
        return this._executeSetFormat(command);
      case COMMAND_TYPES.UNDO:
        return this._executeUndo();
      case COMMAND_TYPES.REDO:
        return this._executeRedo();
      default:
        throw spreadsheetError(
          ERROR_CODES.UNSUPPORTED_COMMAND,
          `Unsupported Spreadsheet command: ${command.type}.`,
          { commandType: command.type }
        );
    }
  }

  _executeSetCellValue(command) {
    this._assertMutable();
    validateTarget(command.target);
    validateCellInput(command.value);
    const range = {
      startRow: command.target.row,
      endRow: command.target.row,
      startColumn: command.target.column,
      endColumn: command.target.column,
    };
    const affectedRanges = [{ sheetId: command.target.sheetId, range }];
    return this._commit(
      command.type,
      snapshot => {
        const worksheet = findWorksheet(snapshot, command.target.sheetId);
        const currentCell = findOrCreateCell(
          worksheet,
          command.target.row,
          command.target.column
        );
        const nextCell = cellInputToLegacyCell(currentCell, command.value);
        const entry = worksheet.celldata.find(
          candidate =>
            candidate.r === command.target.row &&
            candidate.c === command.target.column
        );
        entry.v = nextCell;
      },
      affectedRanges
    );
  }

  _executeSetFormat(command) {
    this._assertMutable();
    assertArgument(
      typeof command.sheetId === "string" && command.sheetId.length > 0,
      "Format command sheetId must be a non-empty string."
    );
    assertArgument(
      Array.isArray(command.ranges) && command.ranges.length > 0,
      "Format command ranges must be a non-empty array."
    );
    command.ranges.forEach(validateRange);
    const patch = command.patch;
    const patchKeys =
      patch && typeof patch === "object" && !Array.isArray(patch)
        ? Object.keys(patch)
        : [];
    if (
      patchKeys.length !== 1 ||
      patchKeys[0] !== "bold" ||
      typeof patch.bold !== "boolean"
    ) {
      throw spreadsheetError(
        ERROR_CODES.UNSUPPORTED_COMMAND,
        "The Fake Spreadsheet supports only an explicit boolean bold format patch.",
        { commandType: command.type, supportedPatch: ["bold"] }
      );
    }
    const affectedRanges = command.ranges.map(range => ({
      sheetId: command.sheetId,
      range: cloneJson(range),
    }));
    return this._commit(
      command.type,
      snapshot => {
        const worksheet = findWorksheet(snapshot, command.sheetId);
        for (const range of command.ranges) {
          for (let row = range.startRow; row <= range.endRow; row += 1) {
            for (
              let column = range.startColumn;
              column <= range.endColumn;
              column += 1
            ) {
              findOrCreateCell(worksheet, row, column).bl = patch.bold ? 1 : 0;
            }
          }
        }
      },
      affectedRanges
    );
  }

  _executeUndo() {
    this._assertMutable();
    if (this._undoStack.length === 0) {
      throw spreadsheetError(
        ERROR_CODES.COMMAND_DISABLED,
        "Undo is disabled because there is no undo history.",
        { commandType: COMMAND_TYPES.UNDO, reasonCode: "NO_UNDO_HISTORY" }
      );
    }
    this._redoStack.push(cloneSpreadsheetSnapshot(this._snapshot));
    this._snapshot = this._undoStack.pop();
    const result = this._nextResult([]);
    this._emit("workbook-change", {
      type: "workbook-change",
      source: "undo",
      commandType: COMMAND_TYPES.UNDO,
      revision: result.revision,
      affectedRanges: [],
    });
    this._emitHistoryAndCapabilities();
    return result;
  }

  _executeRedo() {
    this._assertMutable();
    if (this._redoStack.length === 0) {
      throw spreadsheetError(
        ERROR_CODES.COMMAND_DISABLED,
        "Redo is disabled because there is no redo history.",
        { commandType: COMMAND_TYPES.REDO, reasonCode: "NO_REDO_HISTORY" }
      );
    }
    this._undoStack.push(cloneSpreadsheetSnapshot(this._snapshot));
    this._snapshot = this._redoStack.pop();
    const result = this._nextResult([]);
    this._emit("workbook-change", {
      type: "workbook-change",
      source: "redo",
      commandType: COMMAND_TYPES.REDO,
      revision: result.revision,
      affectedRanges: [],
    });
    this._emitHistoryAndCapabilities();
    return result;
  }

  undo() {
    return this.execute({ type: COMMAND_TYPES.UNDO });
  }

  redo() {
    return this.execute({ type: COMMAND_TYPES.REDO });
  }

  getSelection() {
    this._assertReady();
    return cloneJson(this._selection);
  }

  getCapabilities() {
    this._assertReady();
    return cloneJson(this._capabilitiesWithoutGuard());
  }

  on(eventName, listener) {
    this._assertReady();
    assertArgument(
      EVENT_NAMES.includes(eventName),
      "Unsupported Spreadsheet event name.",
      { eventName }
    );
    assertArgument(
      typeof listener === "function",
      "Event listener must be a function."
    );
    const listeners = this._listeners.get(eventName);
    listeners.add(listener);
    let subscribed = true;

    if (eventName === "ready") {
      queueMicrotask(() => {
        if (
          subscribed &&
          listeners.has(listener) &&
          this.state === LIFECYCLE_STATES.READY
        ) {
          try {
            listener(
              freezeJson({ type: "ready", state: LIFECYCLE_STATES.READY })
            );
          } catch (error) {
            this._listenerErrors.push(error);
          }
        }
      });
    }

    return () => {
      if (!subscribed) return;
      subscribed = false;
      listeners.delete(listener);
    };
  }

  resize() {
    this._assertReady();
  }

  destroy() {
    if (this.state === LIFECYCLE_STATES.DESTROYED) return;
    this.state = LIFECYCLE_STATES.DESTROYED;
    this._emit("destroy", { type: "destroy", state: this.state });
    for (const listeners of this._listeners.values()) listeners.clear();
    this._undoStack = [];
    this._redoStack = [];
    this._snapshot = null;
    this._selection = null;
    this._listenerErrors = [];
    this._host = null;
  }
}

export function createFakeSpreadsheet(container, options = {}) {
  return FakeSpreadsheetInstance.create(container, options);
}
