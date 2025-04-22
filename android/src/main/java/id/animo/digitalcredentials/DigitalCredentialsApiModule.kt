package id.animo.digitalcredentials

import android.app.Activity
import android.app.Activity.RESULT_OK
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

        AsyncFunction("registerCredentials") Coroutine
                { credentialBytesBase64: String, _matcher: String? ->
                    Log.d("DigitalCredentialsApi", "registerCredentials")

                    // Bytes are encoded as base64 for easy passing from TS -> Kotlin
                    val credentialBytes = Base64.decode(credentialBytesBase64, Base64.DEFAULT)

                    val matcher = _matcher?.let { Matcher.fromStringIdentifier(it) } ?: Matcher.CMWALLET

                    DigitalCredentialsApiSingleton.registerCredentials(context, credentialBytes, matcher)
                    return@Coroutine
                }

        Function("sendResponse") { response: String ->
            Log.d("DigitalCredentialsApi", "sendResponse")

            val currentActivity = appContext.activityProvider?.currentActivity ?: throw Exceptions.MissingActivity()

            Log.d("DigitalCredentialsApi", "Component ${currentActivity.componentName.toString()}")

            val result = DigitalCredentialsApiSingleton.getResponseIntent(response)
            currentActivity.setResult(RESULT_OK, result)
            currentActivity.finishAndRemoveTask()
        }

        Function("sendErrorResponse") { errorMessage: String ->
            Log.d("DigitalCredentialsApi", "sendErrorResponse")

            val currentActivity = appContext.activityProvider?.currentActivity ?: throw Exceptions.MissingActivity()
            Log.d("DigitalCredentialsApi", "Component ${currentActivity.componentName.toString()}")

            val result = DigitalCredentialsApiSingleton.getErrorResponseIntent(errorMessage)
            currentActivity.setResult(RESULT_OK, result)
            currentActivity.finishAndRemoveTask()
        }
    }
}
