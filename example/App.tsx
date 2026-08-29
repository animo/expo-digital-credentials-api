import {
  type DcApiMatcher,
  getRegistrationStatus,
  getSharedContainerPath,
  registerCredential,
  registerCredentials,
  removeCredential,
} from '@animo-id/expo-digital-credentials-api'
import { useEffect, useState } from 'react'
import { Button, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { credentials } from './credentials'

export default function App() {
  const [registrationStatus, setRegistrationStatus] = useState('unknown')
  const [registered, setRegistered] = useState<string[]>()

  useEffect(() => {
    getRegistrationStatus().then(setRegistrationStatus).catch(console.error)
  }, [])

  // Credentials the platform cannot present are skipped, so the returned ids say what actually
  // surfaces: on iOS the SD-JWT PID is dropped, on Android all three register.
  const register = (matcher?: DcApiMatcher) =>
    registerCredentials({ android: { matcher }, credentials })
      .then(setRegistered)
      .catch((error) => console.error('error', error))

  // iOS keeps the registered set itself, so a single document can be added or dropped without
  // touching the rest. Android replaces the whole registry at once, and has no equivalent.
  const mdl = credentials[0]
  const addOne = () =>
    registerCredential({ credential: mdl })
      .then(() => setRegistered([...new Set([...(registered ?? []), mdl.id])]))
      .catch((error) => console.error('error', error))

  const removeOne = () =>
    removeCredential(mdl.id)
      .then(() => setRegistered((current) => current?.filter((id) => id !== mdl.id)))
      .catch((error) => console.error('error', error))

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
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
            <Button title={`Add ${mdl.id} only`} onPress={addOne} />
            <View style={{ height: 20 }} />
            <Button title={`Remove ${mdl.id}`} onPress={removeOne} />
            <View style={{ height: 20 }} />
            {/* Where a real wallet keeps its database, so the request UI can open it from the
                provider extension — a different process with its own sandbox. */}
            <Text>Shared container: {sharedContainerPath()}</Text>
          </Group>
        )}
        {registered ? (
          <Group name="Registered">
            <Text>{registered.length ? registered.join(', ') : 'none'}</Text>
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
}
