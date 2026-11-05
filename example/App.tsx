import {
  type DcApiCredential,
  type DcApiMatcher,
  getRegistrationStatus,
  getSharedContainerPath,
  registerCredential,
  registerCredentials,
  removeCredential,
} from '@animo-id/expo-digital-credentials-api'
import { useEffect, useState } from 'react'
import { Button, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { credentials } from './credentials'

// The authority key identifiers of the two readers example/verifier signs requests as.
const verifiers = {
  verifier1: 'hFQxZk3IXsVd5ts6DrZ37pntrrY=',
  verifier2: 'PmJ0O/XhC/wDs0NoVysFZVsdEhk=',
}

const readerOptions = {
  all: { label: 'All', identifiers: [] },
  verifier1: { label: 'Verifier 1', identifiers: [verifiers.verifier1] },
  verifier2: { label: 'Verifier 2', identifiers: [verifiers.verifier2] },
  both: { label: 'Both', identifiers: [verifiers.verifier1, verifiers.verifier2] },
}
type ReaderOption = keyof typeof readerOptions

export default function App() {
  const [registrationStatus, setRegistrationStatus] = useState('unknown')
  const [registered, setRegistered] = useState<string[]>()
  const [withIssuers, setWithIssuers] = useState(true)
  const [readers, setReaders] = useState<ReaderOption>('all')
  // The gates of the last registration, which the controls may no longer show.
  const [registeredGates, setRegisteredGates] = useState({ withIssuers: true, readers: 'all' as ReaderOption })

  useEffect(() => {
    getRegistrationStatus().then(setRegistrationStatus).catch(console.error)
  }, [])

  // Trust gates to try against example/verifier.
  const gates = { withIssuers, readers }
  const withGates = (credential: DcApiCredential): DcApiCredential => ({
    ...credential,
    issuerAuthorityKeyIdentifiers: withIssuers ? credential.issuerAuthorityKeyIdentifiers : [],
    supportedAuthorityKeyIdentifiers: readerOptions[readers].identifiers,
  })

  // Credentials the platform cannot present are skipped, so the returned ids say what actually
  // surfaces: on iOS before 27.3 the SD-JWT PID is dropped, on Android all three register.
  const register = (matcher?: DcApiMatcher) =>
    registerCredentials({ android: { matcher }, credentials: credentials.map(withGates) })
      .then((ids) => {
        setRegistered(ids)
        setRegisteredGates(gates)
      })
      .catch((error) => console.error('error', error))

  // iOS keeps the registered set itself, so a single document can be added or dropped without
  // touching the rest. Android replaces the whole registry at once, and has no equivalent.
  const add = (credential: DcApiCredential) =>
    registerCredential({ credential: withGates(credential) })
      .then(() => {
        setRegistered((current) => [...new Set([...(current ?? []), credential.id])])
        setRegisteredGates(gates)
      })
      .catch((error) => console.error('error', error))

  const remove = (credential: DcApiCredential) =>
    removeCredential(credential.id)
      .then(() => setRegistered((current) => current?.filter((id) => id !== credential.id)))
      .catch((error) => console.error('error', error))

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        <Group name="Trust Gates">
          <View style={styles.row}>
            <Text>Register issuer identifiers</Text>
            <Switch value={withIssuers} onValueChange={setWithIssuers} />
          </View>
          {credentials.map((credential) => (
            <Text key={credential.id} style={[styles.hint, styles.mono]}>
              {credential.id}: {credential.issuerAuthorityKeyIdentifiers?.join(', ')}
            </Text>
          ))}
          <View style={{ height: 20 }} />
          <Text>Readers allowed to ask</Text>
          <View style={styles.choices}>
            {(Object.keys(readerOptions) as ReaderOption[]).map((option) => (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ selected: readers === option }}
                onPress={() => setReaders(option)}
                style={[styles.choice, readers === option && styles.choiceSelected]}
              >
                <Text style={readers === option ? styles.choiceSelectedText : undefined}>
                  {readerOptions[option].label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>
            All accepts unsigned requests too. Both settings apply to every credential on the next registration.
          </Text>
        </Group>
        {Platform.OS === 'android' ? (
          <Group name="Register Credentials">
            <Button title="Multipaz Matcher" onPress={() => register()} />
            <View style={{ height: 20 }} />
            <Button title="Ubique Matcher" onPress={() => register('ubique')} />
            <View style={{ height: 20 }} />
            <Button title="CMWallet Matcher" onPress={() => register('cmwallet')} />
          </Group>
        ) : (
          <Group name="Register Documents">
            <Text>Registration status: {registrationStatus}</Text>
            <View style={{ height: 20 }} />
            <Button title="Register all" onPress={() => register()} />
            <View style={{ height: 20 }} />
            {credentials.map((credential) => (
              <View key={credential.id} style={styles.row}>
                <Text>
                  {credential.id}: {credential.display.title}
                </Text>
                <View style={styles.actions}>
                  <Button title="Add" onPress={() => add(credential)} />
                  <Button title="Remove" onPress={() => remove(credential)} />
                </View>
              </View>
            ))}
            <View style={{ height: 20 }} />
            {/* Where a real wallet keeps its database, so the request UI can open it from the
                provider extension — a different process with its own sandbox. */}
            <Text>Shared container: {sharedContainerPath()}</Text>
          </Group>
        )}
        {registered ? (
          <Group name="Registered">
            <Text>{registered.length ? registered.join(', ') : 'none'}</Text>
            <Text>Issuers: {registeredGates.withIssuers ? "each credential's own" : 'none'}</Text>
            <Text>Readers: {readerOptions[registeredGates.readers].label}</Text>
          </Group>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

/** Throws when the config plugin is not applied, which is worth seeing rather than crashing on. */
function sharedContainerPath() {
  try {
    return getSharedContainerPath()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function Group(props: { name: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupHeader}>{props.name}</Text>
      {props.children}
    </View>
  )
}

const styles = {
  groupHeader: {
    fontSize: 20,
    marginBottom: 20,
  },
  group: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#eee',
  },
  mono: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row' as const,
  },
  choices: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  choice: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 999,
  },
  choiceSelected: {
    backgroundColor: '#007aff',
    borderColor: '#007aff',
  },
  choiceSelectedText: {
    color: '#fff',
  },
  hint: {
    color: '#666',
  },
}
