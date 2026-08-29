/**
 * Just enough CBOR to write the Multipaz matcher's credential database: text strings, byte strings,
 * arrays and text-keyed maps. The matcher looks members up by key, so no canonical ordering is
 * needed, and no other major types occur in the format.
 */
export type CborValue = string | Uint8Array | CborValue[] | { [key: string]: CborValue }

const majorByteString = 2
const majorTextString = 3
const majorArray = 4
const majorMap = 5

export function encodeCbor(value: CborValue): Uint8Array {
  const chunks: Uint8Array[] = []
  write(chunks, value)

  const length = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const result = new Uint8Array(length)

  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}

function write(chunks: Uint8Array[], value: CborValue) {
  if (typeof value === 'string') {
    const bytes = new TextEncoder().encode(value)
    chunks.push(head(majorTextString, bytes.length), bytes)
    return
  }

  if (value instanceof Uint8Array) {
    chunks.push(head(majorByteString, value.length), value)
    return
  }

  if (Array.isArray(value)) {
    chunks.push(head(majorArray, value.length))
    for (const item of value) write(chunks, item)
    return
  }

  const entries = Object.entries(value)
  chunks.push(head(majorMap, entries.length))
  for (const [key, item] of entries) {
    write(chunks, key)
    write(chunks, item)
  }
}

function head(majorType: number, argument: number): Uint8Array {
  if (argument < 24) return Uint8Array.of((majorType << 5) | argument)
  if (argument < 0x100) return Uint8Array.of((majorType << 5) | 24, argument)
  if (argument < 0x10000) return Uint8Array.of((majorType << 5) | 25, argument >> 8, argument & 0xff)

  return Uint8Array.of(
    (majorType << 5) | 26,
    (argument >>> 24) & 0xff,
    (argument >>> 16) & 0xff,
    (argument >>> 8) & 0xff,
    argument & 0xff
  )
}
