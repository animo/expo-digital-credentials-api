import {
  type DigitalCredentialsApiMatcher,
  isGetCredentialActivity,
  registerCredentials,
} from '@animo-id/expo-digital-credentials-api'
import { useMemo } from 'react'
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native'

export default function App() {
  const isDcApi = useMemo(() => isGetCredentialActivity(), [])
  if (isDcApi) {
    console.log('Not rendering main application due to DC API')
    return null
  }

  const register = (matcher: DigitalCredentialsApiMatcher) =>
    registerCredentials({
      debug: true,
      matcher,
      credentials: [
        {
          id: '1',
          display: {
            title: 'Drivers License',
            subtitle: 'Issued by Utopia',
            claims: [
              {
                path: ['org.iso.18013.5.1', 'family_name'],
                displayName: 'Family Name',
              },
            ],
            iconDataUrl:
              'data:image/jpg;base64,/9j/4AAQSkZJRgABAQEASABIAAD//gATQ3JlYXRlZCB3aXRoIEdJTVD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wgARCABLAGQDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAWAQEBAQAAAAAAAAAAAAAAAAAABgj/2gAMAwEAAhADEAAAAZzC6pAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAABw/9oACAEBAAEFAgL/xAAUEQEAAAAAAAAAAAAAAAAAAABw/9oACAEDAQE/AQL/xAAUEQEAAAAAAAAAAAAAAAAAAABw/9oACAECAQE/AQL/xAAUEAEAAAAAAAAAAAAAAAAAAABw/9oACAEBAAY/AgL/xAAUEAEAAAAAAAAAAAAAAAAAAABw/9oACAEBAAE/IQL/2gAMAwEAAgADAAAAEP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/8QAFBEBAAAAAAAAAAAAAAAAAAAAcP/aAAgBAwEBPxAC/8QAFBEBAAAAAAAAAAAAAAAAAAAAcP/aAAgBAgEBPxAC/8QAFBABAAAAAAAAAAAAAAAAAAAAcP/aAAgBAQABPxAC/9k=',
          },
          credential: {
            doctype: 'org.iso.18013.5.1.mDL',
            format: 'mso_mdoc',
            namespaces: {
              'org.iso.18013.5.1': {
                family_name: 'Glastra',
                given_name: 'Timo',
              },
            },
          },
        },
        {
          id: '2',
          display: {
            title: 'PID',
            subtitle: 'Issued by Utopia',
            claims: [
              {
                path: ['first_name'],
                displayName: 'First Name',
              },
              {
                path: ['address', 'city'],
                displayName: 'Resident City',
              },
            ],
            iconDataUrl:
              'data:image/jpg;base64,/9j/4AAQSkZJRgABAQEASABIAAD//gATQ3JlYXRlZCB3aXRoIEdJTVD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wgARCABLAGQDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAWAQEBAQAAAAAAAAAAAAAAAAAABgj/2gAMAwEAAhADEAAAAZzC6pAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAABw/9oACAEBAAEFAgL/xAAUEQEAAAAAAAAAAAAAAAAAAABw/9oACAEDAQE/AQL/xAAUEQEAAAAAAAAAAAAAAAAAAABw/9oACAECAQE/AQL/xAAUEAEAAAAAAAAAAAAAAAAAAABw/9oACAEBAAY/AgL/xAAUEAEAAAAAAAAAAAAAAAAAAABw/9oACAEBAAE/IQL/2gAMAwEAAgADAAAAEP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/wD/AP8A/8QAFBEBAAAAAAAAAAAAAAAAAAAAcP/aAAgBAwEBPxAC/8QAFBEBAAAAAAAAAAAAAAAAAAAAcP/aAAgBAgEBPxAC/8QAFBABAAAAAAAAAAAAAAAAAAAAcP/aAAgBAQABPxAC/9k=',
          },
          credential: {
            vct: 'eu.europa.ec.eudi.pid.1',
            format: 'dc+sd-jwt',
            claims: {
              first_name: 'Timo',
              address: {
                city: 'Somewhere',
              },
            },
          },
        },
      ],
    })
      .then(() => console.log('success', matcher))
      .catch((error) => console.error('error', error))

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        <Group name="Register Credentials">
          <Button title="Ubique Matcher" onPress={() => register('ubique')} />
          <View style={{ height: 20 }} />
          <Button title="CMWallet Matcher" onPress={() => register('cmwallet')} />
        </Group>
      </ScrollView>
    </SafeAreaView>
  )
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
