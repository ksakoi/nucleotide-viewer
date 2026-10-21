import type { FormatErrorCode } from '../i18n'

/** Error while reading a sequence file; `code` selects the localized message shown to the user. */
export class FormatError extends Error {
  readonly code: FormatErrorCode

  constructor(code: FormatErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'FormatError'
    this.code = code
  }
}
