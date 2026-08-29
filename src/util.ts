export function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function encodeBase64(bytes: Uint8Array): string {
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
}

/**
 * Thrown when the Digital Credentials API is not available: an unsupported platform or OS version,
 * a missing native module, or an operation that only one platform has.
 */
export class DcApiUnsupportedError extends Error {}
