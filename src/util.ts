import { Platform } from 'react-native'

export function decodeBase64(str: string): Uint8Array {
  const binaryStr = atob(str)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}

export function encodeBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binString)
}

export function ensureAndroid() {
  if (Platform.OS === 'ios') throw new Error('Expo Digital Credentials API library is not supported on iOS')
}
