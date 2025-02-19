package id.animo.digitalcredentials

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.credentials.DigitalCredential
import androidx.credentials.ExperimentalDigitalCredentialApi
import androidx.credentials.GetCredentialResponse
import androidx.credentials.GetDigitalCredentialOption
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.provider.PendingIntentHandler
import androidx.credentials.registry.provider.RegisterCredentialsRequest
import androidx.credentials.registry.provider.RegistryManager
import androidx.credentials.registry.provider.selectedEntryId
import expo.modules.core.interfaces.SingletonModule
import org.json.JSONObject

@OptIn(ExperimentalDigitalCredentialApi::class)
object DigitalCredentialsApiSingleton : SingletonModule {
    override fun getName(): String {
        return "DigitalCredentialsApiSingleton"
    }

    // members to store the initial launch intent
    var intent: Intent? = null
    var isPending: Boolean = false

    suspend fun registerCredentials(context: Context, credentialBytes: ByteArray) {
        Log.i("DigitalCredentialsApi", "registering credentials")

        val registryManager = RegistryManager.create(context)
        val matcher = loadMatcher(context)

        // For backward compatibility with Chrome
        registryManager.registerCredentials(
                request =
                        object :
                                RegisterCredentialsRequest(
                                        "com.credman.IdentityCredential",
                                        "openid4vp",
                                        credentialBytes,
                                        matcher
                                ) {}
        )

        // In the future, should only register this type
        registryManager.registerCredentials(
                request =
                        object :
                                RegisterCredentialsRequest(
                                        DigitalCredential.TYPE_DIGITAL_CREDENTIAL,
                                        "openid4vp",
                                        credentialBytes,
                                        matcher
                                ) {}
        )
    }

    fun getResponseIntent(response: String): Intent {
        val resultData = Intent()
        PendingIntentHandler.setGetCredentialResponse(
                resultData,
                GetCredentialResponse(DigitalCredential(response))
        )

        return resultData
    }

    fun getErrorResponseIntent(errorMessage: String): Intent {
        val resultData = Intent()
        PendingIntentHandler.setGetCredentialException(
                resultData,
                GetCredentialUnknownException(errorMessage)
        )

        return resultData
    }

    fun isGetCredentialRequestIntent(intent: Intent): Boolean {
        return PendingIntentHandler.retrieveProviderGetCredentialRequest(intent) != null
    }

    fun getRequest(context: Context, intent: Intent): String? {
        val request = PendingIntentHandler.retrieveProviderGetCredentialRequest(intent)
        if (request == null) {
            Log.d("DigitalCredentialsApi", "intent is not a get credentials action")
            return null
        }

        val callingAppInfo = request.callingAppInfo
        val callingPackageName = callingAppInfo.packageName
        val callingOrigin = callingAppInfo.getOrigin(loadAllowedApps(context))

        if (request.credentialOptions.size != 1) {
            throw Error(
                    "Expected only one credentialOption in request, found ${request.credentialOptions.size}"
            )
        }

        val credentialOption = request.credentialOptions.get(0)
        if (credentialOption !is GetDigitalCredentialOption) {
            throw Error("Expected credentialOption to be instance of GetDigitalCredentialOption")
        }

        val requestJson = JSONObject(credentialOption.requestJson)

        val requestReturn = JSONObject()
        requestReturn.put("origin", callingOrigin)
        requestReturn.put("packageName", callingPackageName)
        requestReturn.put("request", requestJson)

        // With the matcher we use now this is JSON, but once we allow custom matchers this
        // structure has to change
        // Currently the whole API is built around the provided matcher
        val selectedEntry = JSONObject(request.selectedEntryId)
        requestReturn.put(
                "selectedEntry",
                JSONObject()
                        .put("providerIndex", selectedEntry.getInt("provider_idx"))
                        .put("credentialId", selectedEntry.getString("id"))
        )

        return requestReturn.toString()
    }

    /**
     * The matcher is taken from https://github.com/leecam/CMWallet We might allow for a custom
     * matcher to be registered in the future
     *
     * Current version:
     * https://github.com/leecam/CMWallet/blob/a9fbdb692b8b2c8a941fba57706e47bbb5a51cf4/app/src/main/assets/openid4vp.wasm
     */
    private fun loadMatcher(context: Context) = loadAsset(context, "openid4vp.wasm")

    /**
     * The allowed apps is required to pass to the getOrigin and is taken from
     * https://github.com/leecam/CMWallet for now This should be configurable in the future.
     */
    private fun loadAllowedApps(context: Context) =
            loadAsset(context, "allowedApps.json").decodeToString()

    private fun loadAsset(context: Context, fileName: String): ByteArray {
        val stream = context.assets.open(fileName)
        val data = ByteArray(stream.available())
        stream.read(data)
        stream.close()
        return data
    }
}
