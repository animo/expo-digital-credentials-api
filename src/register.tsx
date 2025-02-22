import type { PropsWithChildren } from 'react'
import { AppRegistry, Pressable, useWindowDimensions } from 'react-native'
import type { DigitalCredentialsRequest } from './DigitalCredentialsApi.types'
import { sendErrorResponse } from './api'

type AlignContent = 'top' | 'bottom' | 'center'
function WrappingComponent({
  children,
  alignContent = 'bottom',
  cancelOnPressBackground = true,
}: PropsWithChildren<{ alignContent?: AlignContent; cancelOnPressBackground?: boolean }>) {
  const { height, width } = useWindowDimensions()

  return (
    <Pressable
      style={{
        width,
        height,
        display: 'flex',
        justifyContent: alignContent === 'bottom' ? 'flex-end' : alignContent === 'top' ? 'flex-start' : alignContent,
      }}
      onPress={cancelOnPressBackground ? () => sendErrorResponse({ errorMessage: 'User cancelled' }) : undefined}
    >
      {children}
    </Pressable>
  )
}

/**
 * The component that will be rendered for an incoming request
 */
export default function register(
  Component: React.FC<{ request: DigitalCredentialsRequest }>,
  options?: {
    /**
     * Content alingment if content does not take up full screen.
     * @default 'bottom'
     */
    alignContent?: AlignContent

    /**
     * Whether to cancel the submission when the background is pressed.
     * @default true
     */
    cancelOnPressBackground?: boolean
  }
) {
  AppRegistry.registerComponent('DigitalCredentialsApiActivity', () => ({ request }: { request: string }) => (
    <WrappingComponent alignContent={options?.alignContent}>
      <Component request={JSON.parse(request)} />
    </WrappingComponent>
  ))
}
