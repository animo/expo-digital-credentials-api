import type { PropsWithChildren } from 'react'
import { AppRegistry, View } from 'react-native'
import type { DigitalCredentialsRequest } from './DigitalCredentialsApi.types'
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
 * The component that will be rendered for an incoming request
 */
export default function register(Component: React.FC<{ request: DigitalCredentialsRequest }>) {
  ensureAndroid()

  AppRegistry.registerComponent('DigitalCredentialsApiActivity', () => ({ request }: { request: string }) => (
    <WrappingComponent>
      <Component request={JSON.parse(request)} />
    </WrappingComponent>
  ))
}
