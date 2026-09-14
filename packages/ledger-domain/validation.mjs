import { validateSpreadsheetSnapshot } from "../sdk/snapshot.mjs";
import { LEDGER_STATUSES } from "./contracts.mjs";
import { domainValidationError } from "./errors.mjs";

const DEFINITION_KEYS = Object.freeze([
  "id",
  "code",
  "name",
  "version",
  "templateSnapshot",
]);
const INSTANCE_KEYS = Object.freeze([
  "id",
  "definitionVersionId",
  "name",
  "department",
  "period",
  "status",
  "headRevision",
  "createdAt",
  "updatedAt",
]);
const REVISION_KEYS = Object.freeze([
  "id",
  "ledgerId",
  "revision",
  "snapshot",
  "createdBy",
  "createdAt",
]);
const CAPABILITY_KEYS = Object.freeze(["canView", "canEdit", "canSave"]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(value, objectType) {
  if (!isPlainObject(value)) {
    throw domainValidationError(`${objectType} must be a plain object.`, {
      objectType,
    });
  }
}

function assertExactKeys(value, allowedKeys, objectType) {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter(key => !allowed.has(key));
  if (unknownKeys.length > 0) {
    throw domainValidationError(`${objectType} contains unsupported fields.`, {
      objectType,
      unknownKeys,
    });
  }
}

function assertNonEmptyString(value, objectType, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw domainValidationError(
      `${objectType}.${field} must be a non-empty string.`,
      {
        objectType,
        field,
      }
    );
  }
}

function assertPositiveInteger(value, objectType, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw domainValidationError(
      `${objectType}.${field} must be an integer >= 1.`,
      {
        objectType,
        field,
        received: value,
      }
    );
  }
}

function assertIsoTimestamp(value, objectType, field) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw domainValidationError(
      `${objectType}.${field} must be an ISO-8601 timestamp.`,
      { objectType, field, received: value }
    );
  }
}

function assertOptionalDepartment(value, objectType) {
  if (value !== undefined) {
    assertNonEmptyString(value, objectType, "department");
  }
}

function assertOptionalPeriod(value, objectType) {
  if (value !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw domainValidationError(
      `${objectType}.period must use YYYY-MM with a valid month.`,
      { objectType, field: "period", received: value }
    );
  }
}

export function validateLedgerDefinitionVersion(definitionVersion) {
  const objectType = "LedgerDefinitionVersion";
  assertPlainObject(definitionVersion, objectType);
  assertExactKeys(definitionVersion, DEFINITION_KEYS, objectType);
  assertNonEmptyString(definitionVersion.id, objectType, "id");
  assertNonEmptyString(definitionVersion.code, objectType, "code");
  assertNonEmptyString(definitionVersion.name, objectType, "name");
  assertPositiveInteger(definitionVersion.version, objectType, "version");

  // Preserve the SDK's stable INVALID_SNAPSHOT and
  // UNSUPPORTED_SNAPSHOT_VERSION errors instead of defining a second format.
  validateSpreadsheetSnapshot(definitionVersion.templateSnapshot);
  return definitionVersion;
}

export function validateLedgerDefinitionVersionSet(definitionVersions) {
  if (!Array.isArray(definitionVersions)) {
    throw domainValidationError(
      "LedgerDefinitionVersion collection must be an array.",
      { objectType: "LedgerDefinitionVersion[]" }
    );
  }

  const ids = new Set();
  const codeVersions = new Set();
  definitionVersions.forEach((definitionVersion, index) => {
    validateLedgerDefinitionVersion(definitionVersion);
    const codeVersion = `${definitionVersion.code}@${definitionVersion.version}`;
    if (ids.has(definitionVersion.id) || codeVersions.has(codeVersion)) {
      throw domainValidationError(
        "LedgerDefinitionVersion collection contains a duplicate version.",
        {
          objectType: "LedgerDefinitionVersion[]",
          index,
          id: definitionVersion.id,
          code: definitionVersion.code,
          version: definitionVersion.version,
        }
      );
    }
    ids.add(definitionVersion.id);
    codeVersions.add(codeVersion);
  });
  return definitionVersions;
}

export function validateLedgerInstance(instance) {
  const objectType = "LedgerInstance";
  assertPlainObject(instance, objectType);
  assertExactKeys(instance, INSTANCE_KEYS, objectType);
  assertNonEmptyString(instance.id, objectType, "id");
  assertNonEmptyString(
    instance.definitionVersionId,
    objectType,
    "definitionVersionId"
  );
  assertNonEmptyString(instance.name, objectType, "name");
  assertOptionalDepartment(instance.department, objectType);
  assertOptionalPeriod(instance.period, objectType);
  if (instance.status !== LEDGER_STATUSES.DRAFT) {
    throw domainValidationError(
      `LedgerInstance.status must be ${LEDGER_STATUSES.DRAFT} in Phase 1.`,
      { objectType, field: "status", received: instance.status }
    );
  }
  assertPositiveInteger(instance.headRevision, objectType, "headRevision");
  assertIsoTimestamp(instance.createdAt, objectType, "createdAt");
  assertIsoTimestamp(instance.updatedAt, objectType, "updatedAt");
  return instance;
}

export function validateLedgerRevision(revision, options = {}) {
  const objectType = "LedgerRevision";
  assertPlainObject(revision, objectType);
  assertExactKeys(revision, REVISION_KEYS, objectType);
  assertNonEmptyString(revision.id, objectType, "id");
  assertNonEmptyString(revision.ledgerId, objectType, "ledgerId");
  assertPositiveInteger(revision.revision, objectType, "revision");
  validateSpreadsheetSnapshot(revision.snapshot);
  assertNonEmptyString(revision.createdBy, objectType, "createdBy");
  assertIsoTimestamp(revision.createdAt, objectType, "createdAt");

  if (options.ledgerId !== undefined) {
    assertNonEmptyString(
      options.ledgerId,
      "LedgerRevision validation options",
      "ledgerId"
    );
    if (revision.ledgerId !== options.ledgerId) {
      throw domainValidationError(
        "LedgerRevision must belong to the expected LedgerInstance.",
        {
          objectType,
          expectedLedgerId: options.ledgerId,
          receivedLedgerId: revision.ledgerId,
        }
      );
    }
  }
  return revision;
}

export function validateLedgerCapabilities(capabilities) {
  const objectType = "LedgerCapabilities";
  assertPlainObject(capabilities, objectType);
  assertExactKeys(capabilities, CAPABILITY_KEYS, objectType);
  CAPABILITY_KEYS.forEach(field => {
    if (typeof capabilities[field] !== "boolean") {
      throw domainValidationError(`${objectType}.${field} must be a boolean.`, {
        objectType,
        field,
        received: capabilities[field],
      });
    }
  });
  return capabilities;
}
