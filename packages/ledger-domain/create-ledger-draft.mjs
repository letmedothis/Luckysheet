import { INITIAL_LEDGER_REVISION, LEDGER_STATUSES } from "./contracts.mjs";
import { createDraftArgumentError } from "./errors.mjs";
import {
  validateLedgerDefinitionVersion,
  validateLedgerInstance,
  validateLedgerRevision,
} from "./validation.mjs";
import { cloneSpreadsheetSnapshot } from "../sdk/snapshot.mjs";

const CREATE_DRAFT_KEYS = Object.freeze([
  "definitionVersion",
  "ledgerId",
  "revisionId",
  "name",
  "department",
  "period",
  "createdBy",
  "now",
]);

function assertCreateArgument(condition, message, details) {
  if (!condition) throw createDraftArgumentError(message, details);
}

function assertNonEmptyString(value, field) {
  assertCreateArgument(
    typeof value === "string" && value.trim().length > 0,
    `createLedgerDraft.${field} must be a non-empty string.`,
    { field }
  );
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/**
 * Creates the Phase 1 Ledger aggregate's initial persisted state. This function
 * does not write a database and does not read Spreadsheet command revisions.
 *
 * @param {Object} input
 * @param {import("./contracts.mjs").LedgerDefinitionVersion} input.definitionVersion
 * @param {string} input.ledgerId
 * @param {string} input.revisionId
 * @param {string} input.name
 * @param {string=} input.department
 * @param {string=} input.period
 * @param {string} input.createdBy
 * @param {string} input.now ISO-8601 timestamp supplied by the application.
 * @returns {{instance: import("./contracts.mjs").LedgerInstance, revision: import("./contracts.mjs").LedgerRevision}}
 */
export function createLedgerDraft(input) {
  assertCreateArgument(
    input !== null && typeof input === "object" && !Array.isArray(input),
    "createLedgerDraft input must be a plain object."
  );
  const unknownKeys = Object.keys(input).filter(
    key => !CREATE_DRAFT_KEYS.includes(key)
  );
  assertCreateArgument(
    unknownKeys.length === 0,
    "createLedgerDraft input contains unsupported fields.",
    { unknownKeys }
  );

  validateLedgerDefinitionVersion(input.definitionVersion);
  assertNonEmptyString(input.ledgerId, "ledgerId");
  assertNonEmptyString(input.revisionId, "revisionId");
  assertNonEmptyString(input.name, "name");
  assertNonEmptyString(input.createdBy, "createdBy");
  assertNonEmptyString(input.now, "now");

  const instance = {
    id: input.ledgerId,
    definitionVersionId: input.definitionVersion.id,
    name: input.name,
    ...(input.department === undefined ? {} : { department: input.department }),
    ...(input.period === undefined ? {} : { period: input.period }),
    status: LEDGER_STATUSES.DRAFT,
    headRevision: INITIAL_LEDGER_REVISION,
    createdAt: input.now,
    updatedAt: input.now,
  };
  const revision = {
    id: input.revisionId,
    ledgerId: input.ledgerId,
    revision: INITIAL_LEDGER_REVISION,
    snapshot: cloneSpreadsheetSnapshot(
      input.definitionVersion.templateSnapshot
    ),
    createdBy: input.createdBy,
    createdAt: input.now,
  };

  validateLedgerInstance(instance);
  validateLedgerRevision(revision, { ledgerId: instance.id });

  return deepFreeze({ instance, revision });
}
