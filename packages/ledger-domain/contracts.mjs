/**
 * Phase 1 Ledger Domain contract.
 *
 * A Ledger is a business aggregate. SpreadsheetSnapshot is document content
 * stored by a LedgerRevision and is deliberately imported from the Spreadsheet
 * SDK contract instead of being redefined here.
 *
 * @typedef {Object} LedgerDefinitionVersion
 * @property {string} id Stable definition-version identity.
 * @property {string} code Stable definition code.
 * @property {string} name Display name.
 * @property {number} version Positive definition version.
 * @property {import("../sdk/contracts.mjs").SpreadsheetSnapshot} templateSnapshot
 *
 * @typedef {Object} LedgerInstance
 * @property {string} id Stable Ledger identity.
 * @property {string} definitionVersionId Definition version fixed at creation.
 * @property {string} name
 * @property {string=} department Stable department code or ID.
 * @property {string=} period Calendar month in YYYY-MM form.
 * @property {"draft"} status Phase 1 supports draft only.
 * @property {number} headRevision Persisted Ledger revision, starting at 1.
 * @property {string} createdAt ISO-8601 timestamp.
 * @property {string} updatedAt ISO-8601 timestamp.
 *
 * @typedef {Object} LedgerRevision
 * @property {string} id Stable revision identity.
 * @property {string} ledgerId Owning Ledger identity.
 * @property {number} revision Persisted Ledger revision, starting at 1.
 * @property {import("../sdk/contracts.mjs").SpreadsheetSnapshot} snapshot
 * @property {string} createdBy Stable actor identity.
 * @property {string} createdAt ISO-8601 timestamp.
 *
 * @typedef {Object} LedgerCapabilities
 * @property {boolean} canView
 * @property {boolean} canEdit
 * @property {boolean} canSave
 */

export const LEDGER_STATUSES = Object.freeze({
  DRAFT: "draft",
});

export const LEDGER_DOMAIN_ERROR_CODES = Object.freeze({
  INVALID_DOMAIN_OBJECT: "INVALID_LEDGER_DOMAIN_OBJECT",
  INVALID_CREATE_DRAFT_ARGUMENT: "INVALID_CREATE_LEDGER_DRAFT_ARGUMENT",
});

export const INITIAL_LEDGER_REVISION = 1;
