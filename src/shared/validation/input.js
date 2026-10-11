/** @typedef {{ maxLength?: number, maxLengthMessage?: string, allowNewlines?: boolean, required?: boolean, label?: string, requiredMessage?: string }} TextOptions */

export class InputValidationError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "InputValidationError";
    this.code = "INVALID_INPUT";
    this.status = 400;
  }
}

/**
 * Normalize human-entered text without removing legitimate punctuation or
 * markup-looking prose. React should render this as text, never as raw HTML.
 *
 * @param {unknown} value
 * @param {TextOptions} [options]
 */
export function normalizePlainText(value, options = {}) {
  const {
    maxLength = 2000,
    maxLengthMessage,
    allowNewlines = true,
    required = false,
    label = "Text",
    requiredMessage = `${label} is required.`,
  } = options;

  if (!Number.isInteger(maxLength) || maxLength < 0) {
    throw new TypeError("maxLength must be a non-negative integer.");
  }

  let text = String(value ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  if (!allowNewlines) {
    text = text.replace(/[\n\t]+/g, " ").replace(/\s+/g, " ");
  }

  text = text.trim();

  if (required && !text) throw new InputValidationError(requiredMessage);
  if (text.length > maxLength) {
    throw new InputValidationError(
      maxLengthMessage || `${label} is limited to ${maxLength} characters.`,
    );
  }

  return text;
}

/** @param {unknown} value */
export function normalizeEmail(value) {
  const email = normalizePlainText(value, {
    maxLength: 254,
    allowNewlines: false,
    required: true,
    label: "Email address",
    requiredMessage: "Enter your email address.",
  }).toLowerCase();

  // Practical input validation only. Authentication providers must validate it
  // again on the server; this check is not an authentication control.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new InputValidationError("Enter a valid email address.");
  }

  return email;
}
