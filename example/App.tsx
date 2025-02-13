// import { useEvent } from 'expo'
import { registerCredentials } from 'expo-digital-credential-api'
import { Button, SafeAreaView, ScrollView, Text, View } from 'react-native'

export default function App() {
  // const onChangePayload = useEvent(DigitalCredentialsApi, 'onChange')

  const register = () =>
    registerCredentials({ credentials: [] })
      .then((success) => console.log(success))
      .catch((error) => console.error(error))

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
