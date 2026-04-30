import { Asset } from 'expo-asset'
import ubiqueMatcherAsset from '../assets/ubique-matcher.wasm'

const matcherAsset = Asset.fromModule(ubiqueMatcherAsset)
let matcherBytesPromise: Promise<Uint8Array> | null = null

async function loadAssetBytes(asset: Asset): Promise<Uint8Array> {
  if (!asset.localUri) {
    await asset.downloadAsync()
  }

  const uri = asset.localUri ?? asset.uri
  if (!uri) {
    throw new Error('Matcher asset did not resolve to a URI.')
  }

  const response = await fetch(uri)
  if (!response.ok) {
    throw new Error(`Failed to load matcher asset (${response.status}).`)
  }

  const buffer = await response.arrayBuffer()
  return new Uint8Array(buffer)
}

export function loadMatcherBytes(): Promise<Uint8Array> {
  if (!matcherBytesPromise) {
    matcherBytesPromise = loadAssetBytes(matcherAsset)
  }
  return matcherBytesPromise
}
