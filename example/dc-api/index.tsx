// Entry point of the credential request UI on both platforms. It is bundled separately from the
// app: on iOS it runs inside the identity document provider extension, on Android in the activity
// the credential picker launches.
import { registerDcApiScreen } from '@animo-id/expo-digital-credentials-api/request-handler'
import { DcApiScreen } from './DcApiScreen'

export default registerDcApiScreen(DcApiScreen)
