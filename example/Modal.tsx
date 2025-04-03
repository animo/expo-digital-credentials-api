import { type DigitalCredentialsRequest, sendErrorResponse, sendResponse } from '@animo-id/expo-digital-credentials-api'
import { Button, ScrollView } from 'react-native'
import { Text, View } from 'react-native'

export function Modal({ request }: { request: DigitalCredentialsRequest }) {
  return (
    <View style={{ width: '100%' }}>
      <Group name="Digital Credentials API">
        <Button
          title="Send Response"
          onPress={() => sendResponse({ response: JSON.stringify({ vp_token: 'something' }) })}
        />
        <Button
          title="Send Error Response"
          onPress={() => sendErrorResponse({ errorMessage: 'Send error response' })}
        />
      </Group>
      <Group name="Request">
        <ScrollView style={{ height: '100%' }}>
          <Text>{request.origin}</Text>
          <Text>{JSON.stringify(JSON.parse(request.request.providers[0].request), null, 2)}</Text>
        </ScrollView>
      </Group>
    </View>
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
    height: 400,
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
  },
}
