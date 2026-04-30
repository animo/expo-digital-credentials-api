export function decodeBase64(str: string): Uint8Array {
  const binaryStr = atob(str)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}

export function stripImageDataUrl(dataUrl: string): string {
  if (dataUrl.startsWith('data:')) {
    const commaIndex = dataUrl.indexOf(',')
    return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
  }
  return dataUrl
}
