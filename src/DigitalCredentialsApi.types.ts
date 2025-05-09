import type { DigitalCredentialsApiMatcher } from './DigitalCredentialsApiModule'
import type { CredentialItem } from './encodeCredentials'

export interface DigitalCredentialsRequest {
  /**
   * e.g. `https://digital-credentials.dev`
   */
  origin: string

  /**
   * e.g. `com.android.chrome`
   */
  packageName: string

  request:
    | {
        requests?: never

        /**
         * List of providers that can handle the request
         *
         * @deprecated in v1.0 only `requests` should/will be used, but for interoperability
         * you should also handle the providers.
         */
        providers: Array<{
          /**
           * Only OpenID4VP supported at the moment
           */
          protocol: 'openid4vp'

          /**
           * The OpenID4VP specific request as a JSON String
           */
          request: string
        }>
      }
    | {
        providers?: never

        requests: Array<{
          /**
           * Only OpenID4VP supported at the moment
           */
          protocol: 'openid4vp'

          /**
           * The OpenID4VP specific request data as a JSON string
           */
          data: string
        }>
      }

  selectedEntry: {
    /**
     * The credential id as provided to the register credentials method
     */
    credentialId: string

    /**
     * The index of the provider that was selected
     */
    providerIndex: number
  }
}

export interface RegisterCredentialsOptions {
  credentials: CredentialItem[]

  /**
   * The matcher to use. Avaialbe options are:
   * - `cmwallet` (default)
   * - `ubique`
   */
  matcher?: DigitalCredentialsApiMatcher
}
export type { DigitalCredentialsApiMatcher }

export interface SendResponseOptions {
  response: string
}

export interface SendErrorResponseOptions {
  errorMessage: string
}

export type OnRequestEventPayload = {
  request: string
}

export type DigitalCredentialsApiModuleEvents = {
  onRequest: (params: OnRequestEventPayload) => void
}
