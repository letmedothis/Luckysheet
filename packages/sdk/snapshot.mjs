import {
  ERROR_CODES,
  SNAPSHOT_DATA_FORMAT,
  SNAPSHOT_SCHEMA_VERSION,
} from "./contracts.mjs";
import { spreadsheetError } from "./errors.mjs";

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function invalidSnapshot(message, details) {
  return spreadsheetError(ERROR_CODES.INVALID_SNAPSHOT, message, details);
}

function assertJsonValue(value, path, ancestors) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw invalidSnapshot("Snapshot numbers must be finite.", { path });
    }
    return;
  }
  if (typeof value !== "object") {
    throw invalidSnapshot(
      "Snapshot must contain JSON-compatible values only.",
      {
        path,
        valueType: typeof value,
      }
    );
  }
  if (ancestors.has(value)) {
    throw invalidSnapshot("Snapshot must not contain circular references.", {
      path,
    });
  }
  ancestors.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertJsonValue(item, `${path}[${index}]`, ancestors)
    );
  } else {
    if (!isPlainObject(value)) {
      throw invalidSnapshot("Snapshot objects must be plain JSON objects.", {
        path,
      });
    }
    Object.keys(value).forEach(key =>
      assertJsonValue(value[key], `${path}.${key}`, ancestors)
    );
  }
  ancestors.delete(value);
}

export function getWorksheetSheetId(worksheet) {
  const candidate = worksheet.sheetId ?? worksheet.index;
  if (
    (typeof candidate !== "string" && typeof candidate !== "number") ||
    String(candidate).length === 0
  ) {
    throw invalidSnapshot(
      "Every worksheet must have a stable sheetId or legacy index.",
      { worksheetName: worksheet.name ?? null }
    );
  }
  return String(candidate);
}

export function validateSpreadsheetSnapshot(snapshot) {
  if (!isPlainObject(snapshot)) {
    throw invalidSnapshot("Snapshot must be an object.");
  }
  if (!Number.isInteger(snapshot.schemaVersion)) {
    throw invalidSnapshot("Snapshot schemaVersion must be an integer.");
  }
  if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    throw spreadsheetError(
      ERROR_CODES.UNSUPPORTED_SNAPSHOT_VERSION,
      `Unsupported SpreadsheetSnapshot schemaVersion: ${snapshot.schemaVersion}.`,
      {
        received: snapshot.schemaVersion,
        supported: [SNAPSHOT_SCHEMA_VERSION],
      }
    );
  }
  if (snapshot.dataFormat !== SNAPSHOT_DATA_FORMAT) {
    throw invalidSnapshot("Snapshot dataFormat is invalid.", {
      received: snapshot.dataFormat,
      supported: [SNAPSHOT_DATA_FORMAT],
    });
  }
  if (!isPlainObject(snapshot.workbook)) {
    throw invalidSnapshot("Snapshot workbook must be an object.");
  }
  if (!Array.isArray(snapshot.workbook.sheets)) {
    throw invalidSnapshot("Snapshot workbook.sheets must be an array.");
  }
  if (!isPlainObject(snapshot.extensions)) {
    throw invalidSnapshot("Snapshot extensions must be an object.");
  }

  const sheetIds = new Set();
  snapshot.workbook.sheets.forEach((worksheet, index) => {
    if (!isPlainObject(worksheet)) {
      throw invalidSnapshot("Every worksheet must be an object.", { index });
    }
    const sheetId = getWorksheetSheetId(worksheet);
    if (sheetIds.has(sheetId)) {
      throw invalidSnapshot("Worksheet IDs must be unique.", { sheetId });
    }
    sheetIds.add(sheetId);
  });

  assertJsonValue(snapshot, "$", new Set());
  return snapshot;
}

export function cloneSpreadsheetSnapshot(snapshot) {
  validateSpreadsheetSnapshot(snapshot);
  return JSON.parse(JSON.stringify(snapshot));
}
