package id.animo.digitalcredentials

import android.app.Activity.RESULT_OK
import android.content.Context
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
            activity.setResult(
                    RESULT_OK,
                    DigitalCredentialsApiSingleton.getResponseIntent(
                            activity.intent,
                            credentialResponse
                    )
            )
            activity.finishAndRemoveTask()
        }

        Function("sendErrorResponse") { errorMessage: String ->
            val activity = requestActivity
            activity.setResult(
                    RESULT_OK,
                    DigitalCredentialsApiSingleton.getErrorResponseIntent(errorMessage)
            )
            activity.finishAndRemoveTask()
        }
    }
}

internal class NoRequestException :
        CodedException("There is no credential request in flight")
