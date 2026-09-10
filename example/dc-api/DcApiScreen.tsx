import type {
  AndroidDcApiRequest,
  DcApiCredential,
  DcApiProtocolRequest,
  DcApiRequest,
  IosDcApiRequest,
  IosDocumentRequest,
  IosPresentmentRequest,
  IosReaderAuthentication,
} from '@animo-id/expo-digital-credentials-api/request-handler'
import { useMemo, useState } from 'react'
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native'
import { credentials } from '../credentials'

/**
 * Minimal but complete request UI, shared by both platforms.
 *
 * The flow is the same on both: say who is asking and whether that can be proven, show what is being
 * asked for, and only commit once the user accepts. What differs is where the detail comes from — on
 * Android the picker already delivered the protocol request and the credentials it matched, on iOS the
 * OS parsed the request for us and holds the real thing back until `approve()`.
 */
export function DcApiScreen({ request }: { request: DcApiRequest }) {
  const [isSharing, setIsSharing] = useState(false)
  const [error, setError] = useState<string>()

  // What the user picked, over the defaults below: the answering document set per presentment
  // request, and the answering credential per document in it.
  const [chosenSetIndexes, setChosenSetIndexes] = useState<Record<number, number>>({})
  const [chosenCredentialIds, setChosenCredentialIds] = useState<Record<string, string>>({})

  // iOS has no system picker, so the wallet works out itself which of its credentials can answer —
  // from its own storage, since the library keeps no copy of them. This example imports the list
  // directly; a real wallet opens its database in the app group container, which is what
  // `getSharedContainerPath()` is for.
  const plan = useMemo(
    () => (request.platform === 'ios' ? buildPlan(request.presentmentRequests, credentials) : undefined),
    [request]
  )

  const selection = plan?.map((entry) => {
    const setIndex = chosenSetIndexes[entry.presentmentIndex] ?? entry.defaultSetIndex
    const set = entry.sets[setIndex]

    return {
      entry,
      setIndex,
      set,
      documents: (set?.documents ?? []).map((document) => {
        const chosen = document.candidates.find((candidate) => candidate.id === chosenCredentialIds[document.key])

        return { ...document, credential: chosen ?? document.candidates[0] }
      }),
    }
  })

  // Every document the wallet would answer with, in the order the request asked for them. A single
  // Annex C response can carry more than one document, which is what this maps onto.
  const answers = (selection ?? [])
    .filter(({ set }) => set?.isSatisfiable)
    .flatMap(({ documents }) =>
      documents.flatMap((document) =>
        document.credential ? [{ doctype: document.documentRequest.doctype, credentialId: document.credential.id }] : []
      )
    )

  const onShare = async () => {
    setIsSharing(true)
    setError(undefined)

    try {
      if (request.platform === 'ios') {
        // Only now, and not a render earlier: iOS releases the raw request when the wallet commits
        // to answering it, so this is the point of no return.
        const [isoMdoc] = await request.approve()
        if (!isoMdoc) throw new Error('The request carries no supported protocol')

        const data = await buildIsoMdocResponse(isoMdoc.data, request.origin, answers)
        await request.respond({ protocol: 'org-iso-mdoc', data })
        return
      }

      // Android hands over no origin when a native app asked for itself. A response is bound to the
      // origin, so there is nothing to bind to here: this example only answers the web. A wallet
      // that wants to answer apps derives the app-based origin from `callingPackage` instead.
      if (request.origin === undefined) {
        throw new Error(`${request.callingPackage} asked directly; this wallet only answers websites`)
      }

      // Nothing was picked when the caller went straight to the wallet with
      // `identitycredentials.action.GET_CREDENTIALS` instead of through the system picker. A wallet
      // then matches the request against its own storage, the way the iOS branch above has to; this
      // example leans on the picker's match and has nothing to fall back on.
      const { selection } = request
      if (selection === undefined) {
        throw new Error('The request did not come from the system picker, so no credential was matched')
      }

      const selected = pickedRequest(request)
      if (!selected) throw new Error('The request carries no protocol this wallet understands')

      // The picker returns one credential per credential the request asks for together — several
      // when a DCQL query or a deviceRequest asks for more than one — and the response carries them
      // all. Which query each one answers comes from matching it against the request.
      if (selected.protocol === 'org-iso-mdoc') {
        // No doctype to go with the credentials until the deviceRequest is parsed.
        const answers = selection.credentialIds.map((credentialId) => ({ credentialId }))
        const data = await buildIsoMdocResponse(selected.data, request.origin, answers)
        await request.respond({ protocol: selected.protocol, data })
      } else {
        const data = await buildOpenid4vpResponse(selected.data, request.origin, selection.credentialIds)
        await request.respond({ protocol: selected.protocol, data })
      }
    } catch (shareError) {
      // The request is still open on both platforms, so the user can retry or decline.
      setIsSharing(false)
      setError(message(shareError))
    }
  }

  // Android's picker already guaranteed the match — as long as the request came through it at all.
  // On iOS the wallet vouches for it itself: every mandatory presentment request has to have an
  // answer before anything can be shared.
  const canShare =
    request.platform === 'android'
      ? request.selection !== undefined
      : selection !== undefined &&
        answers.length > 0 &&
        selection.every(({ entry, set }) => !entry.isMandatory || set?.isSatisfiable)

  return (
    <View style={styles.sheet}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Share from your wallet?</Text>
        <Text style={styles.origin}>
          {request.origin ??
            (request.platform === 'android' ? `the app ${request.callingPackage}` : 'an unknown origin')}
        </Text>

        {request.platform === 'ios' ? (
          <IosRequestSummary
            request={request}
            selection={selection}
            onSelectSet={(presentmentIndex, setIndex) =>
              setChosenSetIndexes((current) => ({ ...current, [presentmentIndex]: setIndex }))
            }
            onSelectCredential={(key, credentialId) =>
              setChosenCredentialIds((current) => ({ ...current, [key]: credentialId }))
            }
          />
        ) : (
          <AndroidRequestSummary request={request} />
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Button title={isSharing ? 'Sharing…' : 'Share'} onPress={onShare} disabled={isSharing || !canShare} />
          <Button title="Decline" color="#a00" onPress={() => request.decline('declined by the user')} />
        </View>
      </ScrollView>
    </View>
  )
}

/**
 * What iOS knows before `approve()`: who signed the request, and the documents and elements the OS
 * parsed out of it. That is all the consent screen has to go on — and all it needs, since the wallet
 * also picks the answering credentials from it.
 */
function IosRequestSummary({
  request,
  selection,
  onSelectSet,
  onSelectCredential,
}: {
  request: IosDcApiRequest
  selection?: Selection
  onSelectSet: (presentmentIndex: number, setIndex: number) => void
  onSelectCredential: (key: string, credentialId: string) => void
}) {
  return (
    <>
      <ReaderAuthentications readerAuthentications={request.readerAuthentications} />

      {selection?.map(({ entry, setIndex, documents }) => (
        <View key={entry.presentmentIndex} style={styles.group}>
          <Section
            title={entry.isMandatory ? 'Required' : 'Optional'}
            subtitle={
              entry.isMandatory
                ? 'The verifier cannot be answered without this'
                : 'The verifier accepts a response without this'
            }
          >
            {/* Exactly one document set answers a presentment request, so its sets are alternatives
                — and the only real choice the wallet has here. */}
            {entry.sets.length > 1
              ? entry.sets.map((set, candidateSetIndex) => (
                  <Text
                    key={set.key}
                    style={[styles.claim, candidateSetIndex === setIndex && styles.selected]}
                    onPress={() => onSelectSet(entry.presentmentIndex, candidateSetIndex)}
                  >
                    {candidateSetIndex === setIndex ? '● ' : '○ '}
                    {set.documents.map((document) => document.documentRequest.doctype).join(' + ')}
                    {set.isSatisfiable ? '' : ' · not in your wallet'}
                  </Text>
                ))
              : null}
          </Section>

          {/* Every document in the chosen set has to be answered, so each one gets its own credential. */}
          {documents.map((document) => (
            <Section key={document.key} title={document.documentRequest.doctype}>
              {requestedElements(document.documentRequest).map(({ namespace, element, intentToRetain }) => (
                <Text key={`${namespace}.${element}`} style={styles.claim}>
                  {element}
                  {/* The verifier's own claim about keeping the value. Worth showing, not a guarantee. */}
                  {intentToRetain ? <Text style={styles.retained}> · will be stored</Text> : null}
                  {document.credential && !hasElement(document.credential, namespace, element) ? (
                    <Text style={styles.missing}> · not in this credential</Text>
                  ) : null}
                </Text>
              ))}

              {document.candidates.length === 0 ? (
                <Text style={styles.missing}>You have no {document.documentRequest.doctype} to answer this with.</Text>
              ) : (
                document.candidates.map((candidate) => (
                  <Text
                    key={candidate.id}
                    style={[styles.claim, candidate.id === document.credential?.id && styles.selected]}
                    onPress={() => onSelectCredential(document.key, candidate.id)}
                  >
                    {candidate.id === document.credential?.id ? '● ' : '○ '}
                    {candidate.display.title}
                  </Text>
                ))
              )}
            </Section>
          ))}
        </View>
      ))}

      {selection?.length === 0 ? <Section title="The request asks for no documents" /> : null}
    </>
  )
}

/**
 * Who is asking, and whether that can be proven.
 *
 * iOS parses ISO/IEC 18013-5 reader authentication out of the request, so the screen can say this
 * before `approve()`. An empty list means the request carried none, which only reaches a wallet that
 * registered without `ios.supportedAuthorityKeyIdentifiers` — with those set, the OS drops requests
 * that do not chain up to them while matching, and the wallet never sees them.
 *
 * A non-empty list is not by itself a trust decision: it says the request was signed, not that the
 * signer is trusted. A real wallet walks each chain against its own trust list and shows the
 * verifier's name from the leaf certificate rather than a count.
 */
function ReaderAuthentications({ readerAuthentications }: { readerAuthentications: IosReaderAuthentication[] }) {
  if (readerAuthentications.length === 0) {
    return (
      <Section title="Requested by an unverified reader">
        <Text style={styles.missing}>
          The request carries no reader authentication, so nothing proves who is asking.
        </Text>
      </Section>
    )
  }

  return (
    <Section
      title="Requested by an authenticated reader"
      subtitle={`${readerAuthentications.length} certificate chain(s) — check them against your trust list`}
    >
      {readerAuthentications.map((readerAuthentication, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the chains carry no identifier of their own
        <Text key={index} style={styles.claim}>
          {readerAuthentication.certificateChain.length} certificate(s), leaf{' '}
          {readerAuthentication.certificateChain[0]?.slice(0, 24) ?? '<none>'}…
        </Text>
      ))}
      <Text style={styles.hint}>Parse the leaf with an X.509 library to name the verifier here.</Text>
    </Section>
  )
}

/**
 * On Android the picker did the matching and the request came with the result, so the screen only
 * confirms what was picked. Everything else — the requested claims, and who is asking — sits inside
 * the request itself, which is protocol work: see `summarize`.
 */
function AndroidRequestSummary({ request }: { request: AndroidDcApiRequest }) {
  // Without a pick there is no matched request to show, so the first one stands in.
  const selected = pickedRequest(request) ?? request.requests[0]
  const credentialIds = request.selection?.credentialIds ?? []

  return (
    <>
      <Section title="Requested by" subtitle={request.callingPackage}>
        {/* There is no parsed reader authentication on Android: it is part of the request, as
            `readerAuth` in the Annex C deviceRequest or as the signature over a signed OpenID4VP
            request. The protocol identifier is the only hint available without parsing. */}
        <Text style={styles.claim}>{readerAuthenticationHint(selected)}</Text>
      </Section>

      {/* Absent when the caller reached the wallet through `identitycredentials.action.GET_CREDENTIALS`,
          which does not go through the picker. A real wallet matches the request itself then. */}
      <Section title="Sharing" subtitle={request.selection ? 'Picked in the system picker' : 'Nothing was picked'}>
        {credentialIds.length > 0 ? (
          credentialIds.map((credentialId) => (
            <Text key={credentialId} style={styles.claim}>
              {credentialId}
            </Text>
          ))
        ) : (
          <Text style={styles.claim}>
            The request did not come from the system picker, so this example has no credential to answer with.
          </Text>
        )}
      </Section>

      <Section title={selected ? selected.protocol : 'No supported protocol'}>
        {selected ? (
          summarize(selected).map((line) => (
            <Text key={line} style={styles.claim}>
              {line}
            </Text>
          ))
        ) : (
          <Text style={styles.claim}>
            The verifier asked for {request.requests.length} request(s), none of which this wallet knows.
          </Text>
        )}
      </Section>
    </>
  )
}

/**
 * The request the picker matched the credentials against.
 *
 * Exact with the `cmwallet` and `ubique` matchers, and with `multipaz` as long as the verifier sent
 * one request per protocol. When it sent several with the same protocol, `multipaz` does not say
 * which one it matched. It answers the first one the registered credentials satisfy, so a real
 * wallet evaluates the candidates in order against the picked credentials. This example has no DCQL
 * engine and takes the first candidate.
 */
function pickedRequest(request: AndroidDcApiRequest): DcApiProtocolRequest | undefined {
  const index = request.selection?.requestIndex ?? request.selection?.candidateRequestIndexes[0]

  return index === undefined ? undefined : request.requests[index]
}

function readerAuthenticationHint(request?: DcApiProtocolRequest): string {
  if (!request) return 'Nothing to verify — the wallet cannot answer this request.'

  switch (request.protocol) {
    case 'org-iso-mdoc':
      return 'Verify `readerAuth` in the deviceRequest against your trust list; it is absent when the request is unsigned.'
    case 'openid4vp-v1-signed':
    case 'openid4vp-v1-multisigned':
      return 'A signed request — verify the signature, then show the verifier it identifies.'
    default:
      return 'An unsigned request — nothing proves who is asking.'
  }
}

/**
 * A real wallet renders consent from the parsed request. This only goes as far as it can without a
 * CBOR decoder or a JWT verifier — enough to show where each protocol's detail lives.
 */
function summarize(request: DcApiProtocolRequest): string[] {
  if (request.protocol === 'org-iso-mdoc') {
    // Base64url-no-pad CBOR: decode it with an mdoc library to see the doctypes, the elements and
    // the reader auth, exactly like iOS hands over pre-parsed.
    return [`deviceRequest: ${request.data.deviceRequest.slice(0, 32)}…`]
  }

  try {
    const authorizationRequest = JSON.parse(request.data) as {
      dcql_query?: { credentials?: Array<{ id?: string; claims?: Array<{ path?: unknown[] }> }> }
    }

    const credentials = authorizationRequest.dcql_query?.credentials ?? []
    const claims = credentials.flatMap((credential) =>
      (credential.claims ?? []).map((claim) => `${credential.id ?? 'credential'}: ${(claim.path ?? []).join('.')}`)
    )

    return claims.length > 0 ? claims : ['The request carries no DCQL claims to show']
  } catch {
    // Signed requests arrive as a JWT. Verify the signature before showing anything from it.
    return ['A signed request — verify and decode it before rendering consent']
  }
}

/** One document the verifier asked for, with the wallet's credentials that could answer it. */
interface PlanDocument {
  /** Its position in the request, `<presentment>-<set>-<document>` — what the picks are keyed by. */
  key: string
  documentRequest: IosDocumentRequest
  candidates: DcApiCredential[]
}

/** One way to answer a presentment request: all of its documents, or none of them. */
interface PlanSet {
  /** Its position in the request, `<presentment>-<set>`. */
  key: string
  documents: PlanDocument[]

  /** Every document in the set has a credential behind it, so the set can be answered in full. */
  isSatisfiable: boolean
}

/** One presentment request, with each of its document sets matched against the wallet's credentials. */
interface PlanEntry {
  /** Index into `presentmentRequests`, which is what the two selection maps are keyed by. */
  presentmentIndex: number
  isMandatory: boolean

  /** `documentRequestSets`, in order — so the index into this is the set index. */
  sets: PlanSet[]

  /** The first set the wallet can answer in full, or `0` when there is none. */
  defaultSetIndex: number
}

type Selection = Array<{
  entry: PlanEntry
  setIndex: number
  set?: PlanSet
  documents: Array<PlanDocument & { credential?: DcApiCredential }>
}>

/**
 * Match `presentmentRequests` against the wallet's own credentials.
 *
 * The structure carries the verifier's logic, and Apple's documentation spells out how to read it:
 *
 * - a presentment request is answered by *exactly one* of its `documentRequestSets` — the sets are
 *   alternatives, and the only real choice the wallet has;
 * - answering a set means answering *every* `documentRequest` in it, so one response can carry
 *   several documents;
 * - `isMandatory` says whether the presentment request may be left out of the response entirely.
 */
function buildPlan(presentmentRequests: IosPresentmentRequest[], credentials: DcApiCredential[]): PlanEntry[] {
  return presentmentRequests.map((presentmentRequest, presentmentIndex) => {
    const sets = presentmentRequest.documentRequestSets.map((set, setIndex) => {
      const documents = set.documentRequests.map((documentRequest, documentIndex) => ({
        key: `${presentmentIndex}-${setIndex}-${documentIndex}`,
        documentRequest,
        candidates: credentials.filter((credential) => canAnswer(credential, documentRequest)),
      }))

      return {
        key: `${presentmentIndex}-${setIndex}`,
        documents,
        isSatisfiable: documents.length > 0 && documents.every((document) => document.candidates.length > 0),
      }
    })

    return {
      presentmentIndex,
      isMandatory: presentmentRequest.isMandatory,
      sets,
      defaultSetIndex: Math.max(
        sets.findIndex((set) => set.isSatisfiable),
        0
      ),
    }
  })
}

/**
 * Whether one of the wallet's credentials can answer a document request.
 *
 * The doctype decides it: an mdoc response may leave out elements the credential does not carry, so
 * a partial match is still an answer — the screen points those elements out instead of hiding the
 * credential. A wallet that would rather not answer partially tightens this to require every
 * requested element.
 */
function canAnswer(credential: DcApiCredential, documentRequest: IosDocumentRequest): boolean {
  return credential.credential.format === 'mso_mdoc' && credential.credential.doctype === documentRequest.doctype
}

/** The requested elements of one document request, flattened over its namespaces. */
function requestedElements(documentRequest: IosDocumentRequest) {
  return Object.entries(documentRequest.namespaces).flatMap(([namespace, elements]) =>
    Object.entries(elements).map(([element, { intentToRetain }]) => ({ namespace, element, intentToRetain }))
  )
}

function hasElement(credential: DcApiCredential, namespace: string, element: string): boolean {
  if (credential.credential.format !== 'mso_mdoc') return false

  return element in (credential.credential.namespaces[namespace] ?? {})
}

/**
 * Where a real wallet builds the ISO 18013-7 Annex C response, e.g. with Credo:
 *
 * ```ts
 * const resolved = await agent.mdoc.resolveDcApiRequest({ ...data, origin })
 * const { response } = await agent.mdoc.createDcApiResponse({ resolved, credentialIds })
 * ```
 *
 * `response` is the base64url-no-pad `EncryptedResponse`, and the Annex C response is the object
 * around it — which is what `respond()` takes, on both platforms.
 */
async function buildIsoMdocResponse(
  data: { deviceRequest: string; encryptionInfo: string },
  origin: string,
  answers: Array<{ doctype?: string; credentialId: string }>
): Promise<{ response: string }> {
  console.log('[example] building an Annex C response', {
    origin,
    answers,
    deviceRequest: `${data.deviceRequest.slice(0, 32)}…`,
  })
  return { response: 'REPLACE_WITH_ENCRYPTED_RESPONSE' }
}

/** The same, for OpenID4VP: the authorization response reaches the site exactly as returned here. */
async function buildOpenid4vpResponse(
  data: string,
  origin: string,
  credentialIds: string[]
): Promise<Record<string, unknown>> {
  console.log('[example] building an OpenID4VP response', { origin, credentialIds, request: data.slice(0, 64) })
  return { vp_token: 'REPLACE_WITH_VP_TOKEN' }
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  )
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

const styles = StyleSheet.create({
  // The wrapper the library renders this in is transparent on Android, so the sheet paints itself.
  sheet: { flex: 1, backgroundColor: 'white' },
  container: { gap: 12, padding: 24 },
  title: { fontSize: 18, fontWeight: '600' },
  origin: { color: '#555' },
  group: { gap: 12 },
  section: { gap: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#ddd', paddingTop: 8 },
  sectionTitle: { fontWeight: '600' },
  sectionSubtitle: { color: '#777', fontSize: 12 },
  claim: { fontSize: 13 },
  hint: { color: '#777', fontSize: 12 },
  retained: { color: '#a00' },
  missing: { color: '#a00', fontSize: 13 },
  selected: { fontWeight: '600' },
  error: { color: '#a00', fontSize: 12 },
  actions: { gap: 8, paddingTop: 8 },
})
