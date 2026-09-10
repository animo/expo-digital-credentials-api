package id.animo.digitalcredentials

import android.app.Activity.RESULT_OK
import android.content.Context
import android.content.Intent
import android.util.Base64
import androidx.credentials.registry.provider.RegistryManager
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DigitalCredentialsApiModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

    private val requestActivity
        get() = DigitalCredentialsApiSingleton.currentRequestActivity ?: throw NoRequestException()

    override fun definition() = ModuleDefinition {
        Name("DigitalCredentialsApi")

        Function("isSupported") { true }

        // No user permission is involved on Android: a registered wallet always surfaces.
        AsyncFunction("getRegistrationStatus") { "authorized" }

        AsyncFunction("registerCredentials") Coroutine
                { credentialsBase64: String, matcher: String ->
                    // Bytes are encoded as base64 for easy passing from TS -> Kotlin
                    DigitalCredentialsApiSingleton.registerCredentials(
                            context,
                            Base64.decode(credentialsBase64, Base64.DEFAULT),
                            Matcher.fromIdentifier(matcher)
                    )
                    return@Coroutine
                }

        // Explicit type argument: with no parameters the `Coroutine` infix overloads are ambiguous.
        AsyncFunction("removeAllCredentials").Coroutine<Unit> {
            DigitalCredentialsApiSingleton.clearRegistries(RegistryManager.create(context))
        }

        AsyncFunction("sendResponse") { credentialResponse: String ->
            val activity = requestActivity
            // Built here rather than on the main thread, so a response that does not parse rejects
            // the JS call instead of being lost on another thread.
            val result = DigitalCredentialsApiSingleton.getResponseIntent(activity.intent, credentialResponse)
            finish(activity, result)
        }

        // A no-op when nothing is in flight, like on iOS: declining twice, or after the request was
        // already answered, has nothing left to decline.
        Function("sendErrorResponse") { errorMessage: String ->
            val activity = DigitalCredentialsApiSingleton.currentRequestActivity ?: return@Function
            finish(activity, DigitalCredentialsApiSingleton.getErrorResponseIntent(errorMessage))
        }
    }

    /** Neither function is called on the main thread, and finishing an activity belongs there. */
    private fun finish(activity: DigitalCredentialsApiActivity, result: Intent) {
        activity.runOnUiThread {
            activity.setResult(RESULT_OK, result)
            activity.finishAndRemoveTask()
        }
    }
}

internal class NoRequestException :
        CodedException("There is no credential request in flight")
