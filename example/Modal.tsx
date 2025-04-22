import { type DigitalCredentialsRequest, sendErrorResponse, sendResponse } from '@animo-id/expo-digital-credentials-api'
import { ScrollView } from 'react-native'
import { Button, Text, View } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

export function Modal({ request }: { request: DigitalCredentialsRequest }) {
  return (
    <SafeAreaProvider>
      <ModalInner request={request} />
    </SafeAreaProvider>
  )
}

export function ModalInner({ request }: { request: DigitalCredentialsRequest }) {
  const insets = useSafeAreaInsets()

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <View style={{ backgroundColor: 'white', paddingBottom: insets.bottom }}>
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
          <ScrollView>
            <Text>{JSON.stringify(request, null, 2)}</Text>
          </ScrollView>
        </Group>
      </View>
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
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
}
