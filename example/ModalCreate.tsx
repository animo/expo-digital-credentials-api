import {
  type DigitalCredentialsCreateRequest,
  sendCreateErrorResponse,
  sendCreateResponse,
} from '@animo-id/expo-digital-credentials-api'
import { ScrollView } from 'react-native'
import { Button, Text, View } from 'react-native'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'

export function ModalCreate({ request }: { request: DigitalCredentialsCreateRequest }) {
  return (
    <SafeAreaProvider>
      <ModalCreateInner request={request} />
    </SafeAreaProvider>
  )
}

export function ModalCreateInner({ request }: { request: DigitalCredentialsCreateRequest }) {
  const insets = useSafeAreaInsets()

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <View style={{ backgroundColor: 'white', paddingBottom: insets.bottom, height: '50%' }}>
        <Group name="Digital Credentials API (Create)">
          <Button
            title="Send Create Response"
            onPress={() =>
              sendCreateResponse({
                response: JSON.stringify({ protocol: 'openid4vci', data: {} }),
              })
            }
          />
          <Button
            title="Send Create Error Response"
            onPress={() => sendCreateErrorResponse({ errorMessage: 'Send create error response' })}
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
    backgroundColor: '#fff',
    padding: 20,
  },
}
