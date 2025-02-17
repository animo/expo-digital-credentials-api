package id.animo.digitalcredentials

import android.content.Context
import android.util.Base64
import android.util.Log
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DigitalCredentialsApiModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

    override fun definition() = ModuleDefinition {
        Name("DigitalCredentialsApi")

        Events("onRequest")

        AsyncFunction("registerCredentials") Coroutine
                { credentialBytesBase64: String ->
                    Log.d("DigitalCredentialsApi", "registerCredentials")
                    // Bytes are encoded as base64 for easy passing from TS -> Kotlin
                    val credentialBytes = Base64.decode(credentialBytesBase64, Base64.DEFAULT)

                    DigitalCredentialsApiSingleton.registerCredentials(context, credentialBytes)
                    return@Coroutine
                }

        Function("getRequest") {
            Log.d("DigitalCredentialsApi", "getRequest")
            // get the Intent from onCreate activity (app not running in background)
            DigitalCredentialsApiSingleton.isPending = false

            val intent = DigitalCredentialsApiSingleton.intent
            if (intent != null) {
                Log.d("DigitalCredentialsApi", "hasIntent")
                val request = DigitalCredentialsApiSingleton.getRequest(intent)
                Log.d("DigitalCredentialsApi", "getRequestValue $request")
                DigitalCredentialsApiSingleton.intent = null
                return@Function request
            }

            return@Function null
        }

        Function("sendResponse") { response: String ->
            Log.d("DigitalCredentialsApi", "sendResponse")
            DigitalCredentialsApiSingleton.sendResponse(response)
        }

        Function("sendErrorResponse") { errorType: String, errorMessage: String ->
            Log.d("DigitalCredentialsApi", "sendErrorResponse")
            DigitalCredentialsApiSingleton.sendErrorResponse(errorType, errorMessage)
        }

        OnNewIntent {
            Log.d("DigitalCredentialsApi", "OnNewIntent")
            if (DigitalCredentialsApiSingleton.isGetCredentialRequestIntent(it)) {
                Log.d("DigitalCredentialsApi", "OnNewIntent is credentials")
                DigitalCredentialsApiSingleton.intent = it
                DigitalCredentialsApiSingleton.isPending = true
            }
        }
    }
}
