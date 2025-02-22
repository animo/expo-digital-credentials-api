import { registerCredentials } from '@animo-id/expo-digital-credentials-api'
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native'

export default function App() {
  const register = () =>
    registerCredentials({
      credentials: [
        {
          id: '1',
          display: {
            title: 'Drivers License Test',
          },
          credential: {
            doctype: 'org.iso.18013.5.1.mDL',
            format: 'mso_mdoc',
            namespaces: {
              'org.iso.18013.5.1': {
                family_name: 'Glastra',
              },
            },
          },
        },
      ],
    })
      .then(() => console.log('success'))
      .catch((error) => console.error('error', error))

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.container}>
        <Group name="Digital Credentials API">
          <Button title="Register Credentials" onPress={register} />
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
