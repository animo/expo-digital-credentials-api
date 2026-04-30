export interface IssuanceIconPointer {
  /**
   * Byte offset into the creation options payload where the icon bytes start.
   */
  start: number

  /**
   * Byte length of the icon data.
   */
  length: number
}

export interface IssuanceDisplayEntry {
  /**
   * Human-readable title for display.
   */
  title: string

  /**
   * Optional subtitle for display.
   */
  subtitle?: string

  /**
   * Optional icon pointer (or null) into the payload.
   */
  icon?: IssuanceIconPointer | null
}

export interface IssuanceCreationOptionsJson {
  /**
   * Display metadata for the issuance entry.
   */
  display: IssuanceDisplayEntry

  /**
   * Optional issuer allowlist, keyed by issuer URL.
   */
  capabilities?: Record<string, Record<string, never>>
}

/**
 * Issuance creation options bytes layout:
 * - 4-byte little-endian offset to the JSON payload
 * - icon bytes
 * - UTF-8 JSON matching IssuanceCreationOptionsJson
 */
export type IssuanceCreationOptionsBytes = Uint8Array
