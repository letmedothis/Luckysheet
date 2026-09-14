import { LEDGER_DOMAIN_ERROR_CODES } from "./contracts.mjs";

export class LedgerDomainError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "LedgerDomainError";
    this.code = code;
    if (options.details !== undefined) this.details = options.details;
    if (options.cause !== undefined) this.cause = options.cause;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.details === undefined ? {} : { details: this.details }),
    };
  }
}

export function domainValidationError(message, details) {
  return new LedgerDomainError(
    LEDGER_DOMAIN_ERROR_CODES.INVALID_DOMAIN_OBJECT,
    message,
    { details }
  );
}

export function createDraftArgumentError(message, details) {
  return new LedgerDomainError(
    LEDGER_DOMAIN_ERROR_CODES.INVALID_CREATE_DRAFT_ARGUMENT,
    message,
    { details }
  );
}

export function isLedgerDomainError(error, code) {
  return (
    error instanceof LedgerDomainError &&
    (code === undefined || error.code === code)
  );
}
