package id.animo.digitalcredentials

import android.app.Activity.RESULT_OK
import android.content.Context
import android.util.Base64
import android.util.Log
import androidx.credentials.ExperimentalDigitalCredentialApi
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

@OptIn(ExperimentalDigitalCredentialApi::class)
class DigitalCredentialsApiModule : Module() {
    private val context: Context
        get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()


    override fun definition() = ModuleDefinition {
        Name("DigitalCredentialsApi")

        AsyncFunction("registerCredentialsRaw") Coroutine
                { credentialBytesBase64: String, matcherBytesBase64: String, protocol: String?, type: String?, registerCompatType: Boolean? ->
                    Log.d("DigitalCredentialsApi", "registerCredentialsRaw")

                    val credentialBytes = Base64.decode(credentialBytesBase64, Base64.DEFAULT)
                    val matcherBytes = Base64.decode(matcherBytesBase64, Base64.DEFAULT)

                    DigitalCredentialsApiSingleton.registerCredentialsRaw(
                            context,
                            credentialBytes,
                            matcherBytes,
                            protocol ?: "openid4vp",
                            type ?: "${androidx.credentials.DigitalCredential.TYPE_DIGITAL_CREDENTIAL}",
                            registerCompatType ?: true
                    )
                    return@Coroutine
                }

        AsyncFunction("registerCreationOptionsRaw") Coroutine
                { creationOptionsBytesBase64: String, matcherBytesBase64: String, type: String?, id: String?, intentAction: String? ->
                    Log.d("DigitalCredentialsApi", "registerCreationOptionsRaw")

                    val creationOptionsBytes = Base64.decode(creationOptionsBytesBase64, Base64.DEFAULT)
                    val matcherBytes = Base64.decode(matcherBytesBase64, Base64.DEFAULT)

                    DigitalCredentialsApiSingleton.registerCreationOptionsRaw(
                            context,
                            creationOptionsBytes,
                            matcherBytes,
                            type ?: "${androidx.credentials.DigitalCredential.TYPE_DIGITAL_CREDENTIAL}",
                            id ?: "openid4vci",
                            intentAction ?: ""
                    )
                    return@Coroutine
                }

        Function("getRequest") {
            val currentActivity = appContext.activityProvider?.currentActivity ?: throw Exceptions.MissingActivity()
            return@Function DigitalCredentialsApiSingleton.getRequest(context, currentActivity.intent)
        }

        Function("getCreateRequest") {
            val currentActivity = appContext.activityProvider?.currentActivity ?: throw Exceptions.MissingActivity()
            return@Function DigitalCredentialsApiSingleton.getCreateRequest(context, currentActivity.intent)
        }

        Function("setAllowedApps") { allowedAppsJson: String? ->
            Log.d("DigitalCredentialsApi", "setAllowedApps")
            DigitalCredentialsApiSingleton.setAllowedApps(context, allowedAppsJson)
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

        Function("sendCreateResponse") { response: String, type: String?, newEntryId: String? ->
            Log.d("DigitalCredentialsApi", "sendCreateResponse")

            val currentActivity = appContext.activityProvider?.currentActivity ?: throw Exceptions.MissingActivity()
            Log.d("DigitalCredentialsApi", "Component ${currentActivity.componentName.toString()}")

            val result = DigitalCredentialsApiSingleton.getCreateResponseIntent(response, type)
            if (newEntryId != null) {
                result.putExtra("newEntryId", newEntryId)
            }
            currentActivity.setResult(RESULT_OK, result)
            currentActivity.finishAndRemoveTask()
        }

        Function("sendCreateErrorResponse") { errorMessage: String ->
            Log.d("DigitalCredentialsApi", "sendCreateErrorResponse")

            val currentActivity = appContext.activityProvider?.currentActivity ?: throw Exceptions.MissingActivity()
            Log.d("DigitalCredentialsApi", "Component ${currentActivity.componentName.toString()}")

            val result = DigitalCredentialsApiSingleton.getCreateErrorResponseIntent(errorMessage)
            currentActivity.setResult(RESULT_OK, result)
            currentActivity.finishAndRemoveTask()
        }

        Function("isGetCredentialActivity") {
            val currentActivity = appContext.activityProvider?.currentActivity
            return@Function currentActivity is DigitalCredentialsApiActivity
        }

        Function("isCreateCredentialActivity") {
            val currentActivity = appContext.activityProvider?.currentActivity
            return@Function currentActivity is DigitalCredentialsApiCreateCredentialActivity
        }
    }
}
