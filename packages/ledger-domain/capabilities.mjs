import { validateLedgerCapabilities } from "./validation.mjs";

/**
 * Creates an isolated, immutable business capability DTO. These flags express
 * Ledger authorization and are not Spreadsheet Engine capability states.
 */
export function createLedgerCapabilities(input) {
  validateLedgerCapabilities(input);
  return Object.freeze({
    canView: input.canView,
    canEdit: input.canEdit,
    canSave: input.canSave,
  });
}
