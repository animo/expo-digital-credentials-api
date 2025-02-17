package id.animo.digitalcredentials

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.annotation.RequiresApi
import com.google.android.gms.identitycredentials.Credential
import com.google.android.gms.identitycredentials.GetCredentialResponse
import com.google.android.gms.identitycredentials.IdentityCredentialManager
import com.google.android.gms.identitycredentials.IntentHelper
import com.google.android.gms.identitycredentials.RegistrationRequest
import expo.modules.core.interfaces.SingletonModule
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine
import org.json.JSONException
import org.json.JSONObject

object DigitalCredentialsApiSingleton : SingletonModule {
    override fun getName(): String {
        return "DigitalCredentialsApiSingleton"
    }

    // members to store the initial launch intent
    var intent: Intent? = null
    var isPending: Boolean = false

    var ACTION = "androidx.credentials.registry.provider.action.GET_CREDENTIAL"
    var REQUEST_KEY = "android.service.credentials.extra.GET_CREDENTIAL_REQUEST"
    var EXTRA_CREDENTIAL_ID_KEY = "androidx.credentials.registry.provider.extra.CREDENTIAL_ID"

    suspend fun registerCredentials(
            context: Context,
            credentialBytes: ByteArray
    ): RegistrationRequest = suspendCoroutine { continuation ->
        val client = IdentityCredentialManager.Companion.getClient(context)

        val registrationRequest =
                RegistrationRequest(
                        credentials = credentialBytes,
                        matcher = loadMatcher(context),
                        type = "com.credman.IdentityCredential",
                        requestType = "",
                        protocolTypes = emptyList(),
                )

        client.registerCredentials(registrationRequest)
                .addOnSuccessListener { continuation.resume(registrationRequest) }
                .addOnFailureListener { exception ->
                    // Log detailed error information
                    android.util.Log.e("DigitalCredential", "Registration failed", exception)

                    android.util.Log.e("DigitalCredential", "Error message: ${exception.message}")

                    android.util.Log.e("DigitalCredential", "Cause: ${exception.cause}")

                    android.util.Log.e(
                            "DigitalCredential",
                            "Stack trace: ${exception.stackTraceToString()}"
                    )

                    continuation.resumeWithException(exception)
                }
    }

    fun sendResponse(response: String) {
        val resultData = Intent()
        IntentHelper.setGetCredentialResponse(resultData, createGetCredentialResponse(response))
    }

    fun sendErrorResponse(errorType: String, errorMessage: String) {
        val resultData = Intent()
        IntentHelper.setGetCredentialException(resultData, errorType, errorMessage)
    }

    fun isGetCredentialRequestIntent(intent: Intent): Boolean {
        return intent.action == ACTION
    }

    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    fun getRequest(intent: Intent): String? {
        if (intent.action != ACTION) {
            Log.d("DigitalCredentialsApi", "intent is not a get credentials action")
            return null
        }

        val request =
                intent.getParcelableExtra(REQUEST_KEY) as
                        android.service.credentials.GetCredentialRequest?
        if (request == null) {
            Log.d("DigitalCredentialsApi", "intent does not contain a get credentials request ")
            return null
        }
        val credentialId = intent.getStringExtra(EXTRA_CREDENTIAL_ID_KEY)
        if (credentialId == null) {
            Log.d("DigitalCredentialsApi", "intent does not contain a credential id")
            return null
        }

        val callingAppInfo = request.callingAppInfo
        val callingPackageName = callingAppInfo.packageName
        val callingOrigin = callingAppInfo.origin

        val data = request.credentialOptions.get(0).credentialRetrievalData

        val json = JSONObject()
        val keys: Set<String> = data.keySet()
        for (key in keys) {
            try {
                // json.put(key, bundle.get(key)); see edit below
                json.put(key, JSONObject.wrap(data.get(key)))
            } catch (e: JSONException) {
                // Handle exception here
            }
        }

        //        val json = JSONObject()
        //        val provider = json.getJSONArray("providers").getJSONObject(0)

        val requestReturn = JSONObject()
        //        requestReturn.put("provider", provider)
        requestReturn.put("origin", callingOrigin)
        requestReturn.put("packageName", callingPackageName)
        requestReturn.put("data", json)

        return requestReturn.toString()
    }

    private fun loadMatcher(context: Context): ByteArray {
        val stream = context.assets.open("openid4vp.wasm")
        val matcher = ByteArray(stream.available())
        stream.read(matcher)
        stream.close()
        return matcher
    }

    private fun createGetCredentialResponse(response: String): GetCredentialResponse {
        val bundle = Bundle()
        bundle.putByteArray("identityToken", response.toByteArray())
        val credentialResponse = Credential("type", bundle)
        return GetCredentialResponse(credentialResponse)
    }
}
