import { registerRootComponent } from 'expo'

import registerGetCredentialComponent from '../register'
import App from './App'
import { Modal } from './Modal'

// Registers the componetn to be used for sharing credentials
registerGetCredentialComponent(Modal)

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App)
