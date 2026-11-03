/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { encodeMultipazCredentials, parseMultipazSelection } from '../matchers/multipaz'
import type { DcApiCredential } from '../types'
import { encodeBase64 } from '../util'

/**
 * Runs the bundled multipaz matcher the way Credential Manager does: the credential database this
 * package encodes and a Digital Credentials request go in, and the picker entries come out through
 * the host functions of `credentialmanager.h`. This pins the database format and the entry ids to the
 * wasm that actually ships, rather than to our reading of its source.
 */
const matcherWasm = new WebAssembly.Module(
  readFileSync(join(__dirname, '../../android/src/main/assets/multipaz-matcher.wasm'))
)

interface PickerEntry {
  entryId: string
  title: string
  /** `[displayName, value]` of every field the entry shows. */
  fields: Array<[string, string]>
  /** Set for a payment entry, whose title is the payment method. */
  payment?: { merchantName: string; amount: string }
}

interface PickerSet {
  setId: string
  /** One array per slot, holding the credentials the user can choose between for it. */
  slots: PickerEntry[][]
}

/**
 * Runtime version 1 has no sets: its entries come back as the one slot of a set with an empty id.
 */
function runMatcher(
  credentials: DcApiCredential[],
  requests: Array<{ protocol: string; data: unknown }>,
  { wasmVersion = 2 }: { wasmVersion?: 1 | 2 } = {}
) {
  const database = encodeMultipazCredentials(credentials, [
    'openid4vp-v1-unsigned',
    'openid4vp-v1-signed',
    'org-iso-mdoc',
  ])
  // The matcher `malloc`s exactly the size it is told and hands the buffer to `cJSON_Parse`.
  const request = new TextEncoder().encode(`${JSON.stringify({ requests })}\0`)

  const sets = new Map<string, PickerSet>()
  const unsetEntries: PickerEntry[] = []
  // Filled in once the instance exists, which is before any host function runs.
  const wasm: { memory?: WebAssembly.Memory } = {}
  const bytes = () => new Uint8Array((wasm.memory as WebAssembly.Memory).buffer)
  const view = () => new DataView((wasm.memory as WebAssembly.Memory).buffer)
  const string = (pointer: number) => {
    const all = bytes()
    const end = all.indexOf(0, pointer)
    return new TextDecoder().decode(all.subarray(pointer, end))
  }

  const entry = (setId: number, setIndex: number) => {
    const set = sets.get(string(setId))
    if (!set) throw new Error(`Entry added to undeclared set ${string(setId)}`)
    return set.slots[setIndex] as PickerEntry[]
  }

  const imports = {
    credman: {
      GetWasmVersion: (pointer: number) => view().setUint32(pointer, wasmVersion, true),
      GetCallingAppInfo: (pointer: number) => bytes().fill(0, pointer, pointer + 256 + 512),
      GetCredentialsSize: (pointer: number) => view().setUint32(pointer, database.length, true),
      ReadCredentialsBuffer: (buffer: number, offset: number, length: number) => {
        bytes().set(database.subarray(offset, offset + length), buffer)
        return length
      },
      GetRequestSize: (pointer: number) => view().setUint32(pointer, request.length, true),
      GetRequestBuffer: (buffer: number) => bytes().set(request, buffer),
      AddStringIdEntry: (credId: number, _icon: number, _iconLength: number, title: number) => {
        if (wasmVersion === 2) throw new Error('Runtime version 2 should only produce sets')
        unsetEntries.push({ entryId: string(credId), title: string(title), fields: [] })
      },
      AddFieldForStringIdEntry: (credId: number, name: number, value: number) => {
        if (wasmVersion === 2) throw new Error('Runtime version 2 should only produce sets')
        unsetEntries
          .find((candidate) => candidate.entryId === string(credId))
          ?.fields.push([string(name), string(value)])
      },
      AddPaymentEntry: (credId: number, merchantName: number, paymentMethodName: number, ...rest: number[]) => {
        if (wasmVersion === 2) throw new Error('Runtime version 2 should only produce sets')
        unsetEntries.push({
          entryId: string(credId),
          title: string(paymentMethodName),
          fields: [],
          payment: { merchantName: string(merchantName), amount: string(rest[3] as number) },
        })
      },
    },
    credman_v2: {
      AddEntrySet: (setId: number, length: number) => {
        sets.set(string(setId), { setId: string(setId), slots: Array.from({ length }, () => []) })
      },
      AddEntryToSet: (
        credId: number,
        _icon: number,
        _iconLength: number,
        title: number,
        _subtitle: number,
        _disclaimer: number,
        _warning: number,
        _metadata: number,
        setId: number,
        setIndex: number
      ) => {
        entry(setId, setIndex).push({ entryId: string(credId), title: string(title), fields: [] })
      },
      AddFieldToEntrySet: (credId: number, name: number, value: number, setId: number, setIndex: number) => {
        const target = entry(setId, setIndex).find((candidate) => candidate.entryId === string(credId))
        target?.fields.push([string(name), string(value)])
      },
      AddPaymentEntryToSet: (
        credId: number,
        merchantName: number,
        paymentMethodName: number,
        _paymentMethodSubtitle: number,
        _icon: number,
        _iconLength: number,
        amount: number,
        _bankIcon: number,
        _bankIconLength: number,
        _providerIcon: number,
        _providerIconLength: number,
        _metadata: number,
        setId: number,
        setIndex: number
      ) => {
        entry(setId, setIndex).push({
          entryId: string(credId),
          title: string(paymentMethodName),
          fields: [],
          payment: { merchantName: string(merchantName), amount: string(amount) },
        })
      },
    },
    // Only reached for the matcher's own logging, which goes nowhere here.
    wasi_snapshot_preview1: {
      fd_write: (_fd: number, iovs: number, iovsLength: number, written: number) => {
        let total = 0
        for (let i = 0; i < iovsLength; i++) total += view().getUint32(iovs + i * 8 + 4, true)
        view().setUint32(written, total, true)
        return 0
      },
      fd_close: () => 0,
      fd_fdstat_get: () => 0,
      fd_seek: () => 0,
      proc_exit: (code: number) => {
        if (code !== 0) throw new Error(`The matcher exited with ${code}`)
      },
    },
  }

  const instance = new WebAssembly.Instance(matcherWasm, imports)
  wasm.memory = instance.exports.memory as WebAssembly.Memory
  ;(instance.exports._start as () => void)()

  if (wasmVersion === 1) return unsetEntries.length ? [{ setId: '', slots: [unsetEntries] }] : []
  return [...sets.values()]
}

/** What the picker returns when the user confirms a set, taking the first choice in every slot. */
const pick = (set: PickerSet) => set.slots.map((slot) => (slot[0] as PickerEntry).entryId)

const mdl: DcApiCredential = {
  id: 'mdl-1',
  display: {
    title: 'Drivers License',
    claims: [{ path: ['org.iso.18013.5.1', 'family_name'], displayName: 'Family Name' }],
  },
  credential: {
    format: 'mso_mdoc',
    doctype: 'org.iso.18013.5.1.mDL',
    namespaces: { 'org.iso.18013.5.1': { family_name: 'Glastra', age_over_18: true } },
  },
}

const pidMdoc: DcApiCredential = {
  id: 'pid-mdoc-1',
  display: { title: 'PID (mdoc)' },
  credential: {
    format: 'mso_mdoc',
    doctype: 'eu.europa.ec.eudi.pid.1',
    namespaces: { 'eu.europa.ec.eudi.pid.1': { given_name: 'Timo' } },
  },
}

const pid: DcApiCredential = {
  id: 'pid 1',
  display: { title: 'PID', claims: [{ path: ['address', 'city'], displayName: 'Resident City' }] },
  credential: {
    format: 'dc+sd-jwt',
    vct: 'eu.europa.ec.eudi.pid.1',
    claims: { given_name: 'Timo', address: { city: 'Utrecht' } },
  },
}

const pidQuery = {
  id: 'pid',
  format: 'dc+sd-jwt',
  meta: { vct_values: ['eu.europa.ec.eudi.pid.1'] },
  claims: [{ path: ['address', 'city'] }],
}

const mdlQuery = {
  id: 'mdl',
  format: 'mso_mdoc',
  meta: { doctype_value: 'org.iso.18013.5.1.mDL' },
  claims: [{ path: ['org.iso.18013.5.1', 'family_name'] }],
}

const openid4vp = (dcqlQuery: unknown) => ({ protocol: 'openid4vp-v1-unsigned', data: { dcql_query: dcqlQuery } })

describe('the bundled multipaz matcher', () => {
  test('matches a single credential, as a set of one', () => {
    const sets = runMatcher([mdl, pid], [openid4vp({ credentials: [pidQuery] })])

    expect(sets).toEqual([
      {
        setId: '0 openid4vp-v1-unsigned',
        slots: [
          [
            {
              entryId: '0 openid4vp-v1-unsigned pid 1',
              title: 'PID',
              fields: [['Resident City', 'Utrecht']],
            },
          ],
        ],
      },
    ])
    expect(parseMultipazSelection(pick(sets[0] as PickerSet), ['openid4vp-v1-unsigned'])).toEqual({
      credentialIds: ['pid 1'],
      requestIndexes: [0],
    })
  })

  test('matches a query for two credentials as one set with a slot each', () => {
    const [set, ...rest] = runMatcher([mdl, pid], [openid4vp({ credentials: [pidQuery, mdlQuery] })])

    expect(rest).toEqual([])
    // The slots follow the credential query ids in sorted order, not the order of the query.
    expect(pick(set as PickerSet)).toEqual(['0 openid4vp-v1-unsigned mdl-1', '0 openid4vp-v1-unsigned pid 1'])
  })

  test('offers an optional credential set both with and without it', () => {
    const sets = runMatcher(
      [mdl, pid],
      [
        openid4vp({
          credentials: [pidQuery, mdlQuery],
          credential_sets: [{ options: [['pid']] }, { options: [['mdl']], required: false }],
        }),
      ]
    )

    expect(sets.map(pick)).toEqual([
      ['0 openid4vp-v1-unsigned pid 1', '0 openid4vp-v1-unsigned mdl-1'],
      ['1 openid4vp-v1-unsigned pid 1'],
    ])
  })

  test('answers the first request it can satisfy, and names only its protocol', () => {
    const sets = runMatcher(
      [mdl, pid],
      [
        openid4vp({ credentials: [{ ...pidQuery, meta: { vct_values: ['not-in-the-wallet'] } }] }),
        openid4vp({ credentials: [pidQuery] }),
      ]
    )

    // The second request matched, but the entry cannot say so.
    expect(sets.map(pick)).toEqual([['0 openid4vp-v1-unsigned pid 1']])
    expect(
      parseMultipazSelection(pick(sets[0] as PickerSet), ['openid4vp-v1-unsigned', 'openid4vp-v1-unsigned'])
        .requestIndexes
    ).toEqual([0, 1])
  })

  test('matches an Annex C deviceRequest for two documents as one set', () => {
    const deviceRequest = cbor({
      version: '1.0',
      docRequests: [
        itemsRequest('org.iso.18013.5.1.mDL', { 'org.iso.18013.5.1': { family_name: false } }),
        itemsRequest('eu.europa.ec.eudi.pid.1', { 'eu.europa.ec.eudi.pid.1': { given_name: false } }),
      ],
    })

    const sets = runMatcher(
      [mdl, pidMdoc, pid],
      [{ protocol: 'org-iso-mdoc', data: { deviceRequest: base64Url(deviceRequest), encryptionInfo: '' } }]
    )

    expect(sets.map(pick)).toEqual([['0 org-iso-mdoc mdl-1', '0 org-iso-mdoc pid-mdoc-1']])
  })

  test('lets a version 1.0 deviceRequest match a credential missing some of the elements', () => {
    const deviceRequest = cbor({
      version: '1.0',
      docRequests: [
        itemsRequest('org.iso.18013.5.1.mDL', { 'org.iso.18013.5.1': { family_name: false, portrait: false } }),
      ],
    })

    const sets = runMatcher([mdl], [{ protocol: 'org-iso-mdoc', data: { deviceRequest: base64Url(deviceRequest) } }])

    expect(sets.map(pick)).toEqual([['0 org-iso-mdoc mdl-1']])
  })
})

describe('issuer identifiers', () => {
  // The `aki` values of `trusted_authorities` are base64url, ours base64 like on iOS.
  const trustedPidQuery = {
    ...pidQuery,
    trusted_authorities: [{ type: 'aki', values: ['N1OrmtAijM_4g9xcF7evzmkzXVs'] }],
  }

  test('a request naming trusted issuers only matches credentials registered with one of them', () => {
    const trusted = { ...pid, android: { issuerAuthorityKeyIdentifiers: [readerAki] } }
    const other = { ...pid, id: 'pid 2', android: { issuerAuthorityKeyIdentifiers: ['AAECAw=='] } }

    expect(runMatcher([trusted, other], [openid4vp({ credentials: [trustedPidQuery] })]).map(pick)).toEqual([
      ['0 openid4vp-v1-unsigned pid 1'],
    ])
  })

  test('a credential registered without them never matches such a request', () => {
    expect(runMatcher([pid], [openid4vp({ credentials: [trustedPidQuery] })])).toEqual([])
  })

  test('a request naming no issuers matches either way', () => {
    const trusted = { ...pid, android: { issuerAuthorityKeyIdentifiers: [readerAki] } }

    expect(runMatcher([trusted], [openid4vp({ credentials: [pidQuery] })]).map(pick)).toEqual([
      ['0 openid4vp-v1-unsigned pid 1'],
    ])
  })
})

describe('reader gating', () => {
  const gated = { ...pid, android: { supportedAuthorityKeyIdentifiers: [readerAki] } }

  // The matcher only reads the certificates out of the header, so the signature is never checked.
  const signedBy = (certificate: string) => ({
    protocol: 'openid4vp-v1-signed',
    data: {
      request: [
        base64Url(new TextEncoder().encode(JSON.stringify({ alg: 'ES256', x5c: [certificate] }))),
        base64Url(new TextEncoder().encode(JSON.stringify({ dcql_query: { credentials: [pidQuery] } }))),
        'c2lnbmF0dXJl',
      ].join('.'),
    },
  })

  test('a gated credential matches a request signed by one of its readers', () => {
    expect(runMatcher([gated], [signedBy(readerCertificate)]).map(pick)).toEqual([['0 openid4vp-v1-signed pid 1']])
  })

  test('a gated credential never matches an unsigned request', () => {
    expect(runMatcher([gated], [openid4vp({ credentials: [pidQuery] })])).toEqual([])
  })

  test('a gated credential never matches a request signed by another reader', () => {
    const other = { ...pid, android: { supportedAuthorityKeyIdentifiers: ['AAECAw=='] } }

    expect(runMatcher([other], [signedBy(readerCertificate)])).toEqual([])
  })
})

/**
 * A self-signed P-256 certificate whose authority key identifier is `readerAki`, generated with
 * `openssl req -x509 -addext authorityKeyIdentifier=keyid:always`.
 */
const readerCertificate =
  'MIICXDCCAgGgAwIBAgIJAKaDvKASqyK7MAoGCCqGSM49BAMCMBYxFDASBgNVBAMMC1Rlc3QgUmVhZGVyMCAXDTI2MDkxMDEyMTE0M1oYDzIxMjYwODE3MTIxMTQzWjAWMRQwEgYDVQQDDAtUZXN0IFJlYWRlcjCCAUswggEDBgcqhkjOPQIBMIH3AgEBMCwGByqGSM49AQECIQD/////AAAAAQAAAAAAAAAAAAAAAP///////////////zBbBCD/////AAAAAQAAAAAAAAAAAAAAAP///////////////AQgWsY12Ko6k+ez671VdpiGvGUdBrDMU7D2O848PifSYEsDFQDEnTYIhucEk2pmeOETnSa3gZ9+kARBBGsX0fLhLEJH+Lzm5WOkQPJ3A32BLeszoPShOUXYmMKWT+NC4v4af5uO5+tKfA+eFivOM1drMV7Oy7ZAaDe/UfUCIQD/////AAAAAP//////////vOb6racXnoTzucrC/GMlUQIBAQNCAAT4w4CwVubn8CdAS7hibgah1F/HNfdXeRVhb7kSsMjoeBupNukWoANSz6qmkEUQxpskWiCsvUS+FPuThQaxyWODo0IwQDAdBgNVHQ4EFgQUN1OrmtAijM/4g9xcF7evzmkzXVswHwYDVR0jBBgwFoAUN1OrmtAijM/4g9xcF7evzmkzXVswCgYIKoZIzj0EAwIDSQAwRgIhAPmtRVLqSD17AdQ0P5zzzYwRKPQNosXNAe4egYpOFwDDAiEA4VVRky4VIaKFMRe9UG1hExhNEZlptwmYEwgu5ZkvIyI='

/** `37:53:AB:9A:D0:22:8C:CF:F8:83:DC:5C:17:B7:AF:CE:69:33:5D:5B`, in base64. */
const readerAki = 'N1OrmtAijM/4g9xcF7evzmkzXVs='

/**
 * A DocRequest whose itemsRequest is the bare CBOR bytes, which the matcher accepts next to the
 * tagged form.
 */
function itemsRequest(docType: string, nameSpaces: Record<string, Record<string, boolean>>) {
  return { itemsRequest: cbor({ docType, nameSpaces }) }
}

/**
 * Just enough CBOR for a DeviceRequest: the credential database encoder has no booleans or integers.
 */
describe('extended vcts', () => {
  const debitCard: DcApiCredential = {
    id: 'debit-1',
    display: { title: 'Debit card' },
    credential: {
      format: 'dc+sd-jwt',
      vct: 'https://bank.example/debit-card',
      extendedVcts: ['https://wero.example/payment_attestation/v1'],
      claims: { category: 'debit' },
    },
  }

  const query = (vct: string) =>
    openid4vp({
      credentials: [{ id: 'card', format: 'dc+sd-jwt', meta: { vct_values: [vct] }, claims: [{ path: ['category'] }] }],
    })

  test('a request for a vct the credential type extends matches it', () => {
    const [set] = runMatcher([debitCard], [query('https://wero.example/payment_attestation/v1')])
    expect(set?.slots[0]?.[0]?.entryId).toBe('0 openid4vp-v1-unsigned debit-1')
  })

  test('a request for its own vct still matches it, and an unrelated vct does not', () => {
    expect(runMatcher([debitCard], [query('https://bank.example/debit-card')])).toHaveLength(1)
    expect(runMatcher([debitCard], [query('https://other.example/card')])).toEqual([])
  })
})

describe('payments', () => {
  const pasoType = 'urn:paso:sca:global:payment:1'
  const ts12Type = 'urn:eudi:sca:eu.europa.ec:payment:single:1'

  const card: DcApiCredential = {
    id: 'card-1',
    display: { title: 'Visa •••• 1234', claims: [{ path: ['card_holder'], displayName: 'Card holder' }] },
    credential: { format: 'dc+sd-jwt', vct: 'https://bank.example/card', claims: { card_holder: 'Timo' } },
    android: { transactionDataTypes: [pasoType, ts12Type], transactionDataOnly: true },
  }

  const cardQuery = {
    id: 'card',
    format: 'dc+sd-jwt',
    meta: { vct_values: ['https://bank.example/card'] },
    claims: [{ path: ['card_holder'] }],
  }

  const transactionData = (type: string, credentialIds = ['card']) =>
    base64Url(
      new TextEncoder().encode(
        JSON.stringify({
          type,
          credential_ids: credentialIds,
          payload: { amount: '49.99 EUR', payee: { name: 'Shop' } },
        })
      )
    )

  const payment = (type: string, transactions = [transactionData(type)], queries: unknown[] = [cardQuery]) => ({
    protocol: 'openid4vp-v1-unsigned',
    data: { dcql_query: { credentials: queries }, transaction_data: transactions },
  })

  const paymentEntry = {
    entryId: '0 openid4vp-v1-unsigned card-1',
    title: 'Visa •••• 1234',
    fields: [],
    payment: { merchantName: 'Shop', amount: '49.99 €' },
  }

  test.each([pasoType, ts12Type])('shows a %s payment with the card as the payment method', (type) => {
    const sets = runMatcher([card, pid], [payment(type)])

    expect(sets).toEqual([{ setId: '0 openid4vp-v1-unsigned', slots: [[paymentEntry]] }])
    expect(parseMultipazSelection(pick(sets[0] as PickerSet), ['openid4vp-v1-unsigned'])).toEqual({
      credentialIds: ['card-1'],
      requestIndexes: [0],
    })
  })

  test('falls back to a single payment entry on runtime version 1', () => {
    expect(runMatcher([card], [payment(pasoType)], { wasmVersion: 1 })).toEqual([
      { setId: '', slots: [[paymentEntry]] },
    ])
  })

  test('a gated card never matches a request without transaction data', () => {
    expect(runMatcher([card], [openid4vp({ credentials: [cardQuery] })])).toEqual([])
  })

  test('a card without transactionDataOnly also matches a request without transaction data', () => {
    const authorizer = { ...card, android: { transactionDataTypes: [pasoType] } }

    expect(runMatcher([authorizer], [openid4vp({ credentials: [cardQuery] })])).toHaveLength(1)
    expect(runMatcher([authorizer], [payment(pasoType)])).toEqual([
      { setId: '0 openid4vp-v1-unsigned', slots: [[paymentEntry]] },
    ])
  })

  test('a gated card never matches transaction data of a type it does not list', () => {
    expect(runMatcher([card], [payment('urn:example:other:1')])).toEqual([])
    expect(
      runMatcher([card], [payment(pasoType, [transactionData(pasoType), transactionData('urn:example:other:1')])])
    ).toEqual([])
  })

  test('a request with transaction data it cannot read matches nothing', () => {
    expect(runMatcher([card], [payment(pasoType, ['not base64url json'])])).toEqual([])
    expect(runMatcher([card], [payment(pasoType, [transactionData(pasoType), 'not base64url json'])])).toEqual([])
    expect(runMatcher([card, pid], [payment(pasoType, [], [cardQuery, pidQuery])])).toEqual([])
    expect(runMatcher([card], [payment(pasoType, [transactionData(pasoType, [])])])).toEqual([])
  })

  test('a request with transaction data naming no credential query matches nothing', () => {
    expect(
      runMatcher(
        [card, pid],
        [payment(pasoType, [transactionData(pasoType, ['card', 'other'])], [cardQuery, pidQuery])]
      )
    ).toEqual([])
  })

  test('two payments for one card get the regular entry', () => {
    const [set] = runMatcher([card], [payment(pasoType, [transactionData(pasoType), transactionData(ts12Type)])])

    expect(set?.slots).toEqual([
      [{ entryId: '0 openid4vp-v1-unsigned card-1', title: 'Visa •••• 1234', fields: [['Card holder', 'Timo']] }],
    ])
  })

  test('credentials without transaction data types never match a query carrying transaction data', () => {
    expect(
      runMatcher([card, pid], [payment(pasoType, [transactionData(pasoType, ['card', 'pid'])], [cardQuery, pidQuery])])
    ).toEqual([])
  })

  test('credentials without transaction data types match the other queries, next to the payment', () => {
    const [set] = runMatcher([card, pid], [payment(pasoType, [transactionData(pasoType)], [cardQuery, pidQuery])])

    expect(set?.slots).toEqual([
      [paymentEntry],
      [{ entryId: '0 openid4vp-v1-unsigned pid 1', title: 'PID', fields: [['Resident City', 'Utrecht']] }],
    ])
  })
})

type TestCbor = string | number | boolean | Uint8Array | TestCbor[] | { [key: string]: TestCbor }

function cbor(value: TestCbor): Uint8Array {
  const head = (major: number, argument: number) =>
    argument < 24
      ? [(major << 5) | argument]
      : argument < 0x100
        ? [(major << 5) | 24, argument]
        : [(major << 5) | 25, argument >> 8, argument & 0xff]

  if (typeof value === 'boolean') return Uint8Array.of(value ? 0xf5 : 0xf4)
  if (typeof value === 'number') return Uint8Array.from(head(0, value))
  if (typeof value === 'string') {
    const encoded = new TextEncoder().encode(value)
    return Uint8Array.from([...head(3, encoded.length), ...encoded])
  }
  if (value instanceof Uint8Array) return Uint8Array.from([...head(2, value.length), ...value])
  if (Array.isArray(value))
    return Uint8Array.from([...head(4, value.length), ...value.flatMap((item) => [...cbor(item)])])

  const entries = Object.entries(value)
  return Uint8Array.from([
    ...head(5, entries.length),
    ...entries.flatMap(([key, item]) => [...cbor(key), ...cbor(item)]),
  ])
}

function base64Url(bytes: Uint8Array) {
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
