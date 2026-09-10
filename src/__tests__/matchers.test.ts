import { describe, expect, test } from 'vitest'
import { encodeCredentialsBase64 } from '../matchers'
import { encodeCbor } from '../matchers/cbor'
import { encodeCredmanCredentials, parseCredmanSelection } from '../matchers/credman'
import { encodeMultipazCredentials, parseMultipazSelection } from '../matchers/multipaz'
import type { DcApiCredential } from '../types'

const mdl: DcApiCredential = {
  id: 'mdl-1',
  display: {
    title: 'Drivers License',
    subtitle: 'Utopia',
    claims: [{ path: ['org.iso.18013.5.1', 'family_name'], displayName: 'Family Name' }],
  },
  credential: {
    format: 'mso_mdoc',
    doctype: 'org.iso.18013.5.1.mDL',
    namespaces: { 'org.iso.18013.5.1': { family_name: 'Glastra', age_over_18: true } },
  },
}

const pid: DcApiCredential = {
  id: 'pid-1',
  display: {
    title: 'PID',
    claims: [{ path: ['address', 'city'], displayName: 'Resident City' }],
  },
  credential: {
    format: 'dc+sd-jwt',
    vct: 'eu.europa.ec.eudi.pid.1',
    claims: { first_name: 'Timo', address: { city: 'Utrecht' } },
  },
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

describe('cbor', () => {
  test('encodes the major types the credential database uses', () => {
    // RFC 8949 examples
    expect(hex(encodeCbor(''))).toBe('60')
    expect(hex(encodeCbor('a'))).toBe('6161')
    expect(hex(encodeCbor('IETF'))).toBe('6449455446')
    expect(hex(encodeCbor(new Uint8Array([1, 2, 3, 4])))).toBe('4401020304')
    expect(hex(encodeCbor([]))).toBe('80')
    expect(hex(encodeCbor({}))).toBe('a0')
    expect(hex(encodeCbor({ a: 'A', b: ['B'] }))).toBe('a2616161416162816142')
  })

  test('widens the head for lengths that do not fit inline', () => {
    expect(hex(encodeCbor('x'.repeat(24)))).toMatch(/^7818/)
    expect(hex(encodeCbor('x'.repeat(256)))).toMatch(/^790100/)
    expect(hex(encodeCbor(new Uint8Array(65536)))).toMatch(/^5a00010000/)
  })
})

describe('multipaz matcher', () => {
  test('encodes the credential database the matcher parses', () => {
    const encoded = encodeMultipazCredentials([mdl], ['openid4vp', 'org-iso-mdoc'])

    // Golden vector, decoded and checked against CredentialDatabase.cpp:
    // { "protocols": ["openid4vp", "org-iso-mdoc"],
    //   "credentials": [{ "title": "Drivers License", "subtitle": "Utopia", "bitmap": h'',
    //     "mdoc": { "documentId": "mdl-1", "docType": "org.iso.18013.5.1.mDL",
    //       "namespaces": { "org.iso.18013.5.1": {
    //         "family_name": ["Family Name", "Glastra", "Glastra"],
    //         "age_over_18": ["age_over_18", "true", "true"] } } } }] }
    expect(hex(encoded)).toBe(
      'a26970726f746f636f6c7382696f70656e69643476706c6f72672d69736f2d6d646f63' +
        '6b63726564656e7469616c7381a4657469746c656f44726976657273204c6963656e7365' +
        '687375627469746c656655746f706961666269746d617040' +
        '646d646f63a36a646f63756d656e744964656d646c2d31' +
        '67646f6354797065756f72672e69736f2e31383031332e352e312e6d444c' +
        '6a6e616d65737061636573a1716f72672e69736f2e31383031332e352e31a2' +
        '6b66616d696c795f6e616d65836b46616d696c79204e616d6567476c617374726167476c6173747261' +
        '6b6167655f6f7665725f3138836b6167655f6f7665725f313864747275656474727565'
    )
  })

  test('flattens SD-JWT claims onto the paths the matcher looks up', () => {
    const encoded = text(encodeMultipazCredentials([pid], ['openid4vp']))

    // The matcher keys claims by their path joined with '.', and takes the display name from the
    // matching entry in `display.claims`.
    expect(encoded).toContain('address.city')
    expect(encoded).toContain('Resident City')
    expect(encoded).toContain('first_name')
    expect(encoded).toContain('eu.europa.ec.eudi.pid.1')
  })

  test('drops a value too long for a DCQL comparison', () => {
    const portrait = 'x'.repeat(200)
    const encoded = text(
      encodeMultipazCredentials(
        [
          {
            ...mdl,
            credential: { format: 'mso_mdoc', doctype: 'x', namespaces: { ns: { portrait } } },
          },
        ],
        ['openid4vp']
      )
    )

    // A DCQL value is never 200 characters long, so only the copy the picker draws carries it.
    expect(encoded.match(/x{200}/g)).toHaveLength(1)
  })

  test('shows a value without matching on it', () => {
    const encoded = text(
      encodeMultipazCredentials(
        [
          {
            ...mdl,
            display: {
              ...mdl.display,
              claims: [{ path: ['ns', 'birth_date'], displayName: 'Date of birth', displayValue: '1 januari 1990' }],
            },
            credential: {
              format: 'mso_mdoc',
              doctype: 'x',
              namespaces: { ns: { birth_date: '1990-01-01' } },
            },
          },
        ],
        ['openid4vp']
      )
    )

    // The wallet's own rendering is drawn, while the raw value stays what a DCQL `values` is
    // compared against.
    expect(encoded).toContain('1 januari 1990')
    expect(encoded).toContain('1990-01-01')
  })

  test('registers a nested SD-JWT claim next to the claims it holds', () => {
    const encoded = text(
      encodeMultipazCredentials(
        [
          {
            ...pid,
            credential: {
              format: 'dc+sd-jwt',
              vct: 'eu.europa.ec.eudi.pid.1',
              claims: { address: { city: 'Utrecht', street: 'Nieuwegracht' } },
            },
          },
        ],
        ['openid4vp']
      )
    )

    // A request asking for `address` matches the same credential one asking for `address.city`
    // does. The object itself has no value a query could carry, so it is registered without one.
    expect(encoded).toContain('address.city')
    expect(encoded).toContain('Utrecht')
  })

  test('refuses identifiers that are not base64', () => {
    const credential = { ...pid, android: { issuerAuthorityKeyIdentifiers: ['N1OrmtAijM_4g9xcF7evzmkzXVs'] } }

    expect(() => encodeMultipazCredentials([credential], ['openid4vp'])).toThrow(
      "'android.issuerAuthorityKeyIdentifiers' holds 'N1OrmtAijM_4g9xcF7evzmkzXVs', which is not base64, for credential 'pid-1'"
    )
  })

  test('parses the picker entry ids', () => {
    expect(parseMultipazSelection(['0 org-iso-mdoc mdl-1'], ['openid4vp', 'org-iso-mdoc'])).toEqual({
      credentialIds: ['mdl-1'],
      requestIndexes: [1],
    })

    // Document ids may contain spaces, the first two fields cannot.
    expect(parseMultipazSelection(['2 openid4vp my credential'], ['openid4vp'])).toEqual({
      credentialIds: ['my credential'],
      requestIndexes: [0],
    })

    expect(() => parseMultipazSelection(['nonsense'], ['openid4vp'])).toThrow(/Unexpected selected entry id/)
  })

  test('parses a picked set, one credential per slot', () => {
    expect(
      parseMultipazSelection(['1 openid4vp-v1-signed pid-1', '1 openid4vp-v1-signed mdl-1'], ['openid4vp-v1-signed'])
    ).toEqual({ credentialIds: ['pid-1', 'mdl-1'], requestIndexes: [0] })
  })

  test('names every request with the matched protocol, since the entries do not say which', () => {
    expect(
      parseMultipazSelection(['0 openid4vp pid-1'], ['openid4vp', 'org-iso-mdoc', 'openid4vp']).requestIndexes
    ).toEqual([0, 2])

    // A protocol the verifier did not send cannot be mapped at all.
    expect(parseMultipazSelection(['0 openid4vp pid-1'], ['org-iso-mdoc']).requestIndexes).toEqual([])
  })
})

describe('cmwallet / ubique matcher', () => {
  test('encodes the offset-prefixed blob', () => {
    const encoded = encodeCredmanCredentials([mdl, pid], { debug: true })
    const jsonOffset = new DataView(encoded.buffer, encoded.byteOffset).getInt32(0, true)

    // No icons, so the JSON starts right after the offset itself.
    expect(jsonOffset).toBe(4)

    const json = JSON.parse(text(encoded.slice(jsonOffset)))
    expect(json.debug).toBe(true)
    expect(json.credentials.mso_mdoc['org.iso.18013.5.1.mDL'][0]).toMatchObject({
      id: 'mdl-1',
      title: 'Drivers License',
      icon: null,
      paths: {
        'org.iso.18013.5.1': {
          family_name: { display: 'Family Name', value: 'Glastra' },
          age_over_18: { display: 'age_over_18', value: true },
        },
      },
    })
    expect(json.credentials['dc+sd-jwt']['eu.europa.ec.eudi.pid.1'][0].paths).toEqual({
      first_name: { display: 'first_name', value: 'Timo' },
      address: { city: { display: 'Resident City', value: 'Utrecht' } },
    })
  })

  test('slices icons out of the region before the JSON', () => {
    const encoded = encodeCredmanCredentials(
      [{ ...mdl, display: { ...mdl.display, iconDataUrl: 'data:image/png;base64,AAECAw==' } }],
      {}
    )
    const jsonOffset = new DataView(encoded.buffer, encoded.byteOffset).getInt32(0, true)
    const json = JSON.parse(text(encoded.slice(jsonOffset)))

    expect(json.credentials.mso_mdoc['org.iso.18013.5.1.mDL'][0].icon).toEqual({ start: 4, length: 4 })
    expect([...encoded.slice(4, 8)]).toEqual([0, 1, 2, 3])
  })

  test('refuses a reader gate it would drop', () => {
    const gated = { ...pid, android: { supportedAuthorityKeyIdentifiers: ['AAECAw=='] } }

    expect(() => encodeCredentialsBase64('cmwallet', [gated], { protocols: ['openid4vp'] })).toThrow(
      /cannot gate credential 'pid-1' on its reader/
    )
    // Issuer identifiers only narrow what `trusted_authorities` matches, which these matchers ignore.
    const withIssuer = { ...pid, android: { issuerAuthorityKeyIdentifiers: ['AAECAw=='] } }
    expect(() => encodeCredentialsBase64('ubique', [withIssuer], { protocols: ['openid4vp'] })).not.toThrow()
  })

  test('parses the picker entry id', () => {
    expect(parseCredmanSelection([JSON.stringify({ provider_idx: 1, id: 'mdl-1' })])).toEqual({
      credentialIds: ['mdl-1'],
      requestIndexes: [1],
    })

    expect(() => parseCredmanSelection([JSON.stringify({ provider_idx: 0 })])).toThrow(/Unexpected selected entry id/)
  })
})
