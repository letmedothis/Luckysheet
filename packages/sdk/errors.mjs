import { ERROR_CODES } from "./contracts.mjs";

export class SpreadsheetSdkError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "SpreadsheetSdkError";
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

export function spreadsheetError(code, message, details, cause) {
  return new SpreadsheetSdkError(code, message, { details, cause });
}

export function isSpreadsheetSdkError(error, code) {
  return (
    error instanceof SpreadsheetSdkError &&
    (code === undefined || error.code === code)
  );
}

export function assertArgument(condition, message, details) {
  if (!condition) {
    throw spreadsheetError(ERROR_CODES.INVALID_ARGUMENT, message, details);
  }
}
