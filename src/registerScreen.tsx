import type { PropsWithChildren } from 'react'
import { AppRegistry, Platform, View } from 'react-native'
import { parseRequest } from './request'
import type { DcApiRequest } from './types'

/**
 * The `AppRegistry` name both platform hosts start the request UI with.
 */
const dcApiComponentName = 'DigitalCredentialsApi'

/**
 * On Android the activity is transparent and the component is rendered as a bottom sheet; on iOS the
 * provider extension already owns a sheet, so the component fills it.
 */
function WrappingComponent({ children }: PropsWithChildren) {
  return (
    <View
      style={
        Platform.OS === 'ios'
          ? { flex: 1, width: '100%', height: '100%' }
          : {
              flex: 1,
              width: '100%',
              height: '100%',
              backgroundColor: 'transparent',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
            }
      }
    >
      {children}
    </View>
  )
}

/**
 * Register the component that renders an incoming credential request.
 *
 * Android renders it in a transparent activity, iOS inside the identity document provider
 * extension. The component receives the same {@link DcApiRequest} on both platforms.
 *
 * Call this from the request UI's own entry file (`dc-api/index.tsx` by default, see the `entry`
 * option of the config plugin): it is bundled separately from the app on both platforms.
 */
export function registerDcApiScreen(Screen: React.FC<{ request: DcApiRequest }>) {
  // biome-ignore lint/suspicious/noExplicitAny: the host passes the native payload, not a DcApiRequest
  const Wrapped = ({ request }: { request: any }) => (
    <WrappingComponent>
      <Screen request={parseRequest(request)} />
    </WrappingComponent>
  )

  AppRegistry.registerComponent(dcApiComponentName, () => Wrapped)
}

export default registerDcApiScreen
