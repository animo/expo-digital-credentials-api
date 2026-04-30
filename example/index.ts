import React from 'react'
import { registerRootComponent } from 'expo'
import { isCreateCredentialActivity, isGetCredentialActivity } from '@animo-id/expo-digital-credentials-api'

import registerGetCredentialComponent, { registerCreateCredentialComponent } from '../register'
import { Modal } from './Modal'
import { ModalCreate } from './ModalCreate'

// Always register the main app for now (quick test to confirm activity checks are the issue).
// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
// Registers the component to be used for sharing credentials
registerGetCredentialComponent(Modal)
registerCreateCredentialComponent(ModalCreate)

const LazyApp = React.lazy(() => import('./App'))

function Root() {
  let isDcApi = false
  try {
    isDcApi = isGetCredentialActivity() || isCreateCredentialActivity()
  } catch {
    // ignore and fall back to normal app render
  }

  if (isDcApi) return null

  return React.createElement(
    React.Suspense,
    { fallback: null },
    React.createElement(LazyApp, null)
  )
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root)
