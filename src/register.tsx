import type { PropsWithChildren } from 'react'
import { AppRegistry, View } from 'react-native'
import type { DigitalCredentialsCreateRequest, DigitalCredentialsRequest } from './DigitalCredentialsApi.types'
import { normalizeGetRequest } from './normalize'
import { ensureAndroid } from './util'

function WrappingComponent({ children }: PropsWithChildren) {
  return (
    <View
      style={{
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
      }}
    >
      {children}
    </View>
  )
}

/**
 * The component that will be rendered for an incoming get-credential request.
 */
export default function registerGetCredentialComponent(
  Component: React.FC<{ request: DigitalCredentialsRequest }>
) {
  ensureAndroid()

  AppRegistry.registerComponent('DigitalCredentialsApiActivity', () => ({ request }: { request: string }) => (
    <WrappingComponent>
      <Component request={normalizeGetRequest(request)} />
    </WrappingComponent>
  ))
}

/**
 * The component that will be rendered for an incoming create-credential request.
 */
export function registerCreateCredentialComponent(
  Component: React.FC<{ request: DigitalCredentialsCreateRequest }>
) {
  ensureAndroid()

  AppRegistry.registerComponent(
    'DigitalCredentialsApiCreateCredentialActivity',
    () => ({ request }: { request: string }) => (
      <WrappingComponent>
        <Component request={JSON.parse(request)} />
      </WrappingComponent>
    )
  )
}
