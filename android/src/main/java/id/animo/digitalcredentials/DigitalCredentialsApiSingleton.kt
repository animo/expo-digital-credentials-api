package id.animo.digitalcredentials

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.content.ComponentName
import android.service.credentials.CredentialProviderService
import android.util.Log
import androidx.credentials.CreateCredentialRequest
import androidx.credentials.CredentialOption
import androidx.credentials.CreateCustomCredentialResponse
import androidx.credentials.DigitalCredential
import androidx.credentials.ExperimentalDigitalCredentialApi
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.CreateCredentialUnknownException
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.provider.CallingAppInfo
import androidx.credentials.provider.PendingIntentHandler
import androidx.credentials.provider.ProviderGetCredentialRequest
import androidx.credentials.provider.ProviderCreateCredentialRequest
import androidx.credentials.registry.provider.RegisterCreationOptionsRequest
import androidx.credentials.registry.provider.RegisterCredentialsRequest
import androidx.credentials.registry.provider.RegistryManager
import androidx.credentials.registry.provider.selectedCredentialSet
import androidx.credentials.registry.provider.selectedEntryId
import expo.modules.core.interfaces.SingletonModule
import java.io.ByteArrayInputStream
import java.util.zip.GZIPInputStream
import org.json.JSONArray
import org.json.JSONObject

private const val PROTOCOL_OPENID4VP = "openid4vp"
private const val ALLOWED_APPS_PREFS = "digital_credentials_api"
private const val ALLOWED_APPS_KEY = "allowed_apps_json"
private const val BUNDLE_KEY_REQUEST_JSON = "androidx.credentials.BUNDLE_KEY_REQUEST_JSON"

@OptIn(ExperimentalDigitalCredentialApi::class)
object DigitalCredentialsApiSingleton : SingletonModule {
    override fun getName(): String {
        return "DigitalCredentialsApiSingleton"
    }

    suspend fun registerCredentialsRaw(
            context: Context,
            credentialBytes: ByteArray,
            matcherBytes: ByteArray,
            protocol: String = PROTOCOL_OPENID4VP,
            type: String = DigitalCredential.TYPE_DIGITAL_CREDENTIAL,
            registerCompatType: Boolean = true
    ) {
        val registryManager = RegistryManager.create(context)
        val matcherInstance = maybeDecompressGzip(matcherBytes)

        if (registerCompatType) {
            registryManager.registerCredentials(
                    request =
                            object :
                                    RegisterCredentialsRequest(
                                            "com.credman.IdentityCredential",
                                            protocol,
                                            credentialBytes,
                                            matcherInstance
                                    ) {}
            )
        }

        registryManager.registerCredentials(
                request =
                        object :
                                RegisterCredentialsRequest(
                                        type,
                                        protocol,
                                        credentialBytes,
                                        matcherInstance
                                ) {}
        )
    }

    suspend fun registerCreationOptionsRaw(
            context: Context,
            creationOptionsBytes: ByteArray,
            matcherBytes: ByteArray,
            type: String = DigitalCredential.TYPE_DIGITAL_CREDENTIAL,
            id: String = "openid4vci",
            intentAction: String = ""
    ) {
        val registryManager = RegistryManager.create(context)
        val matcherInstance = maybeDecompressGzip(matcherBytes)

        registryManager.registerCreationOptions(
                object :
                        RegisterCreationOptionsRequest(
                                creationOptions = creationOptionsBytes,
                                matcher = matcherInstance,
                                type = type,
                                id = id,
                                intentAction = intentAction
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

    fun getCreateResponseIntent(response: String, type: String?): Intent {
        val resultData = Intent()
        val responseType = if (type.isNullOrBlank()) DigitalCredential.TYPE_DIGITAL_CREDENTIAL else type

        val responseObj = CreateCustomCredentialResponse(
                type = responseType,
                data = Bundle().apply {
                    putString("androidx.credentials.BUNDLE_KEY_RESPONSE_JSON", response)
                }
        )

        PendingIntentHandler.setCreateCredentialResponse(resultData, responseObj)
        return resultData
    }

    fun getCreateErrorResponseIntent(errorMessage: String): Intent {
        val resultData = Intent()
        PendingIntentHandler.setCreateCredentialException(
                resultData,
                CreateCredentialUnknownException(errorMessage)
        )

        return resultData
    }

    fun getRequest(context: Context, intent: Intent): String? {
        val request = PendingIntentHandler.retrieveProviderGetCredentialRequest(intent)
        if (request == null) {
            Log.d("DigitalCredentialsApi", "intent is not a get credentials action")
            return null
        }

        val rawBundle = request.sourceBundle ?: ProviderGetCredentialRequest.asBundle(request)
        val raw = bundleToJson(rawBundle)
        val normalized = buildNormalizedRequest(context, raw, request)
        return normalized.toString()
    }

    fun getCreateRequest(context: Context, intent: Intent): String? {
        val request = toCreateRequest(intent)
        if (request == null) {
            Log.d("DigitalCredentialsApi", "intent is not a create credential action")
            return null
        }

        val callingAppInfo = request.callingAppInfo
        val callingPackageName = callingAppInfo.packageName
        val callingOrigin = callingAppInfo.getOrigin(loadAllowedApps(context))

        val requestJsonString = request.callingRequest.credentialData.getString(BUNDLE_KEY_REQUEST_JSON)
        val requestJson = if (requestJsonString != null) JSONObject(requestJsonString) else null

        val requestReturn = JSONObject()
        requestReturn.put("origin", callingOrigin)
        requestReturn.put("packageName", callingPackageName)
        requestReturn.put("type", request.callingRequest.type)
        requestReturn.put("request", requestJson)

        return requestReturn.toString()
    }

    fun setAllowedApps(context: Context, allowedAppsJson: String?) {
        val prefs = context.getSharedPreferences(ALLOWED_APPS_PREFS, Context.MODE_PRIVATE)
        if (allowedAppsJson.isNullOrBlank()) {
            prefs.edit().remove(ALLOWED_APPS_KEY).apply()
        } else {
            prefs.edit().putString(ALLOWED_APPS_KEY, allowedAppsJson).apply()
        }
    }

    private fun toCreateRequest(intent: Intent): ProviderCreateCredentialRequest? {
        val tmpRequestInfo = CreateCredentialRequest.DisplayInfo("userId")
        return if (Build.VERSION.SDK_INT >= 34) {
            val request = intent.getParcelableExtra(
                    CredentialProviderService.EXTRA_CREATE_CREDENTIAL_REQUEST,
                    android.service.credentials.CreateCredentialRequest::class.java
            ) ?: return null
            try {
                ProviderCreateCredentialRequest(
                        callingRequest =
                                CreateCredentialRequest.createFrom(
                                        request.type,
                                        request.data.apply {
                                            putBundle(CreateCredentialRequest.DisplayInfo.BUNDLE_KEY_REQUEST_DISPLAY_INFO, tmpRequestInfo.toBundle())
                                        },
                                        request.data,
                                        requireSystemProvider = false,
                                        request.callingAppInfo.origin
                                ),
                        callingAppInfo =
                                CallingAppInfo.create(
                                        request.callingAppInfo.packageName,
                                        request.callingAppInfo.signingInfo,
                                        request.callingAppInfo.origin
                                ),
                        biometricPromptResult = null
                )
            } catch (e: IllegalArgumentException) {
                null
            }
        } else {
            val requestBundle = intent.getBundleExtra(
                    "android.service.credentials.extra.CREATE_CREDENTIAL_REQUEST"
            ) ?: return null
            val requestDataBundle = requestBundle.getBundle(
                    "androidx.credentials.provider.extra.CREATE_REQUEST_CREDENTIAL_DATA"
            ) ?: Bundle()
            requestDataBundle.putBundle(
                    CreateCredentialRequest.DisplayInfo.BUNDLE_KEY_REQUEST_DISPLAY_INFO,
                    tmpRequestInfo.toBundle()
            )
            requestBundle.putBundle(
                    "androidx.credentials.provider.extra.CREATE_REQUEST_CREDENTIAL_DATA",
                    requestDataBundle
            )
            try {
                ProviderCreateCredentialRequest.fromBundle(requestBundle)
            } catch (e: Exception) {
                null
            }
        }
    }

    /**
     * The allowed apps is required to pass to the getOrigin and is taken from
     * https://github.com/leecam/CMWallet for now This should be configurable in the future.
     */
    private fun loadAllowedApps(context: Context) =
            loadAllowedAppsOverride(context) ?: loadAsset(context, "allowedApps.json").decodeToString()

    private fun loadAllowedAppsOverride(context: Context): String? {
        val prefs = context.getSharedPreferences(ALLOWED_APPS_PREFS, Context.MODE_PRIVATE)
        return prefs.getString(ALLOWED_APPS_KEY, null)
    }

    private fun loadAsset(context: Context, fileName: String): ByteArray {
        val data = context.assets.open(fileName).use { it.readBytes() }
        return maybeDecompressGzip(data)
    }

    private fun maybeDecompressGzip(data: ByteArray): ByteArray {
        if (data.size < 2) return data
        if (data[0] != 0x1f.toByte() || data[1] != 0x8b.toByte()) return data
        return GZIPInputStream(ByteArrayInputStream(data)).use { it.readBytes() }
    }

    private fun bundleToJson(bundle: Bundle): JSONObject {
        val json = JSONObject()
        for (key in bundle.keySet()) {
            json.put(key, bundleValueToJson(bundle.get(key)))
        }
        return json
    }

    private fun buildNormalizedRequest(
        context: Context,
        raw: JSONObject,
        request: ProviderGetCredentialRequest
    ): JSONObject {
        // Start from the raw bundle to ensure no data is lost.
        val normalized = JSONObject(raw.toString())
        normalized.put("sourceBundle", raw)

        val callingAppInfo = request.callingAppInfo
        val origin = callingAppInfo.getOrigin(loadAllowedApps(context))
        if (!origin.isNullOrBlank()) normalized.put("origin", origin)
        callingAppInfo.packageName.takeIf { it.isNotBlank() }?.let { normalized.put("packageName", it) }
        callingAppInfo.signingInfo?.toString()?.takeIf { it.isNotBlank() }?.let { normalized.put("signingInfo", it) }

        val options = buildCredentialOptions(request.credentialOptions)
        if (options.length() > 0) {
            normalized.put("credentialOptions", options)
        }

        extractRequestJson(request.credentialOptions)?.let { normalized.put("request", it) }
        buildSelectionInfo(request)?.let { normalized.put("selection", it) }

        return normalized
    }

    private fun extractRequestJson(options: List<CredentialOption>): JSONObject? {
        for (option in options) {
            val requestData = option.requestData ?: continue
            val requestJson = requestData.get(BUNDLE_KEY_REQUEST_JSON)
            if (requestJson is JSONObject) return requestJson
            if (requestJson is String) {
                try {
                    return JSONObject(requestJson)
                } catch (_e: Exception) {
                    continue
                }
            }
        }
        return null
    }

    private fun buildCredentialOptions(credentialOptions: List<CredentialOption>): JSONArray {
        val optionsArray = JSONArray()
        for (credentialOption in credentialOptions) {
            val optionJson = JSONObject()
            optionJson.put("type", credentialOption.type)
            optionJson.put("isSystemProviderRequired", credentialOption.isSystemProviderRequired)
            optionJson.put("isAutoSelectAllowed", credentialOption.isAutoSelectAllowed)
            optionJson.put("typePriorityHint", credentialOption.typePriorityHint)

            credentialOption.candidateQueryData?.let { optionJson.put("candidateQueryData", bundleToJson(it)) }
            credentialOption.requestData?.let { optionJson.put("retrievalData", bundleToJson(it)) }

            val providers = JSONArray()
            credentialOption.allowedProviders?.forEach { provider: ComponentName ->
                providers.put(provider.flattenToString())
            }
            optionJson.put("allowedProviders", providers)

            optionsArray.put(optionJson)
        }
        return optionsArray
    }

    private fun buildSelectionInfo(request: ProviderGetCredentialRequest): JSONObject? {
        val entryIdJsonString = request.selectedEntryId
        if (!entryIdJsonString.isNullOrBlank()) {
            return parseSelectionFromEntryId(entryIdJsonString)
        }

        val selectedSet = request.selectedCredentialSet ?: return null
        val credentialSetId = selectedSet.credentialSetId ?: return null

        val requestIdx = credentialSetId
                .substringBefore(";")
                .substringAfter("req:", "")
                .toIntOrNull() ?: 0

        val creds = JSONArray()
        for (credential in selectedSet.credentials) {
            val cred = JSONObject()
            cred.put("entryId", credential.credentialId)

            val metadataString = credential.metadata
            if (!metadataString.isNullOrBlank()) {
                try {
                    val metadata = JSONObject(metadataString)
                    cred.put("metadata", metadata)
                } catch (_e: Exception) {
                    // Ignore malformed metadata
                }
            }

            creds.put(cred)
        }

        return JSONObject().put("requestIdx", requestIdx).put("creds", creds)
    }

    private fun parseSelectionFromEntryId(entryIdJson: String): JSONObject? {
        return try {
            val obj = JSONObject(entryIdJson)
            val requestIdx =
                    if (obj.has("req_idx")) obj.getInt("req_idx")
                    else if (obj.has("provider_idx")) obj.getInt("provider_idx")
                    else 0
            val entryId =
                    if (obj.has("entry_id")) obj.getString("entry_id")
                    else if (obj.has("id")) obj.getString("id")
                    else null
            val cred = JSONObject()
            if (!entryId.isNullOrBlank()) cred.put("entryId", entryId)
            if (obj.has("metadata") && obj.get("metadata") is JSONObject) {
                cred.put("metadata", obj.getJSONObject("metadata"))
            } else {
                // Preserve the full metadata payload when provided via selectedEntryId JSON.
                cred.put("metadata", obj)
            }

            JSONObject().put("requestIdx", requestIdx).put("creds", JSONArray().put(cred))
        } catch (_e: Exception) {
            null
        }
    }

    private fun bundleValueToJson(value: Any?): Any {
        if (value == null) return JSONObject.NULL

        return when (value) {
            is JSONObject -> value
            is JSONArray -> value
            is Bundle -> bundleToJson(value)
            is Boolean, is Int, is Long, is Double, is Float, is String -> value
            is CharSequence -> value.toString()
            is ByteArray -> {
                val array = JSONArray()
                for (b in value) {
                    array.put(b.toInt() and 0xFF)
                }
                array
            }
            is BooleanArray -> {
                val array = JSONArray()
                for (v in value) array.put(v)
                array
            }
            is IntArray -> {
                val array = JSONArray()
                for (v in value) array.put(v)
                array
            }
            is LongArray -> {
                val array = JSONArray()
                for (v in value) array.put(v)
                array
            }
            is FloatArray -> {
                val array = JSONArray()
                for (v in value) array.put(v)
                array
            }
            is DoubleArray -> {
                val array = JSONArray()
                for (v in value) array.put(v)
                array
            }
            is Array<*> -> {
                val array = JSONArray()
                for (v in value) array.put(bundleValueToJson(v))
                array
            }
            is Collection<*> -> {
                val array = JSONArray()
                for (v in value) array.put(bundleValueToJson(v))
                array
            }
            else -> value.toString()
        }
    }
}
