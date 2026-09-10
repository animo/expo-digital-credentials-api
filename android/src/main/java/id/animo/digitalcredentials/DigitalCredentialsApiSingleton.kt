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
import androidx.credentials.registry.provider.ClearCredentialRegistryException
import androidx.credentials.registry.provider.ClearCredentialRegistryRequest
import androidx.credentials.registry.provider.RegisterCredentialsRequest
import androidx.credentials.registry.provider.RegistryManager
import androidx.credentials.registry.provider.selectedCredentialSet
import androidx.credentials.registry.provider.selectedEntryId
import expo.modules.core.interfaces.SingletonModule
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject
import java.lang.ref.WeakReference

/** The wasm matchers bundled with this package. Which one is registered is a wallet's choice. */
enum class Matcher(val identifier: String, val asset: String) {

    /**
     * The matcher from https://github.com/openwallet-foundation/multipaz
     * (`multipaz-dcapi/src/androidMain/assets/identitycredentialmatcher.wasm`, Apache-2.0).
     *
     * The only bundled matcher that answers `org-iso-mdoc` requests, and the default.
     *
     * Current version:
     * https://github.com/openwallet-foundation/multipaz/blob/1b045d0e/multipaz-dcapi/src/androidMain/assets/identitycredentialmatcher.wasm
     */
    MULTIPAZ("multipaz", "multipaz-matcher.wasm"),

    /**
     * The matcher is taken from https://github.com/digitalcredentialsdev/CMWallet
     *
     * This is the matcher before support for icons was added, which has broken the selection
     *
     * Current version:
     * https://github.com/digitalcredentialsdev/CMWallet/blob/f4aa9ebbeaf55fa3973b467701887464be3d4b51/app/src/main/assets/openid4vp.wasm
     */
    CMWALLET("cmwallet", "cmwallet-matcher.wasm"),

    /**
     * The matcher is taken from https://github.com/UbiqueInnovation/oid4vp-wasm-matcher
     *
     * Current version: https://github.com/UbiqueInnovation/oid4vp-wasm-matcher/releases/tag/v0.1.0
     */
    UBIQUE("ubique", "ubique-matcher.wasm");

    companion object {
        fun fromIdentifier(value: String): Matcher =
                entries.find { it.identifier == value.lowercase() }
                        ?: throw IllegalArgumentException("Unknown matcher value: $value")
    }
}

@OptIn(ExperimentalDigitalCredentialApi::class)
object DigitalCredentialsApiSingleton : SingletonModule {
    override fun getName(): String {
        return "DigitalCredentialsApiSingleton"
    }

    private const val TAG = "DigitalCredentialsApi"
    private const val PREFERENCES = "id.animo.digitalcredentials"
    private const val MATCHER_KEY = "matcher"

    /**
     * androidx keys a registry by (type, id); the id carries no protocol meaning. Everything this
     * package registers goes into one registry, because the matcher itself decides which protocols
     * a credential answers.
     */
    private const val REGISTRY_ID = "dc-api"

    /** The id versions before this one registered under. */
    private const val LEGACY_REGISTRY_ID = "openid4vp"

    /** Chrome still looks for the legacy type, so the registry is written under both. */
    private val REGISTRY_TYPES =
            listOf("com.credman.IdentityCredential", DigitalCredential.TYPE_DIGITAL_CREDENTIAL)

    private var currentRequestActivityReference: WeakReference<DigitalCredentialsApiActivity>? = null

    /**
     * The activity showing the request UI, if any. Only one request is in flight at a time, and the
     * request UI runs on its own react host — so rather than going through the activity provider of
     * whichever host happens to answer, the activity publishes itself here. Mirrors
     * `DcApiRequestSessionStore` on iOS.
     *
     * Held weakly: the activity clears it in `onDestroy`, but a destroyed activity must not outlive
     * itself here if that is ever skipped.
     */
    var currentRequestActivity: DigitalCredentialsApiActivity?
        get() = currentRequestActivityReference?.get()
        set(value) {
            currentRequestActivityReference = value?.let { WeakReference(it) }
        }

    suspend fun registerCredentials(context: Context, credentialBytes: ByteArray, matcher: Matcher) {
        Log.i(TAG, "registering ${credentialBytes.size} bytes with the ${matcher.identifier} matcher")

        // The request UI runs in its own process-local bundle and has to know how to read the
        // picker's entry id, which is matcher specific.
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                .edit()
                .putString(MATCHER_KEY, matcher.identifier)
                .apply()

        val registryManager = RegistryManager.create(context)
        val matcherBytes = loadMatcher(context, matcher)

        // Registering under an id that is already registered replaces it, so the new set goes in
        // before anything is cleared: a registration that fails leaves the previous set in place
        // rather than none at all.
        for (type in REGISTRY_TYPES) {
            registryManager.registerCredentials(
                    request =
                            object :
                                    RegisterCredentialsRequest(
                                            type,
                                            REGISTRY_ID,
                                            credentialBytes,
                                            matcherBytes
                                    ) {}
            )
        }

        // Registries written by earlier versions used a different id, and would otherwise stay live
        // alongside this one — showing every credential twice in the picker. Best effort: the new
        // set is already in place, so a failure here only leaves a stale duplicate behind.
        try {
            clearRegistries(registryManager, isDeleteAll = false, registryIds = listOf(LEGACY_REGISTRY_ID))
        } catch (error: ClearCredentialRegistryException) {
            Log.w(TAG, "could not clear the registry an earlier version wrote", error)
        }
    }

    /**
     * Drop registries of the types this package writes. With `isDeleteAll` that is every registry
     * of those types the app holds — including any the app wrote through `RegistryManager` itself —
     * otherwise only the given ids.
     */
    suspend fun clearRegistries(
            registryManager: RegistryManager,
            isDeleteAll: Boolean = true,
            registryIds: List<String> = emptyList()
    ) {
        for (type in REGISTRY_TYPES) {
            registryManager.clearCredentialRegistry(
                    ClearCredentialRegistryRequest(
                            ClearCredentialRegistryRequest.PerTypeConfig(
                                    isDeleteAll = isDeleteAll,
                                    type = type,
                                    registryIds = registryIds
                            )
                    )
            )
        }
    }

    /**
     * The response as the caller expects it: `{ "protocol": …, "data": … }`, which is what JS hands
     * over — protocol envelope included — so it goes through as it is.
     *
     * The envelope is not optional and nothing native adds it — `DigitalCredential` only checks that
     * what it is handed is valid JSON, so a bare payload leaves the app looking like a success and
     * fails in the browser instead. The verifier asked for a list of protocols and only the wallet
     * knows which one it answered, which is why `protocol` travels with the response.
     */
    fun getResponseIntent(requestIntent: Intent, credentialResponse: String): Intent {
        val credentialData =
                try {
                    JSONObject(credentialResponse)
                } catch (cause: JSONException) {
                    throw IllegalArgumentException(
                            "The credential response must be a JSON object",
                            cause
                    )
                }

        Log.d(TAG, "responding to the '${credentialData.optString("protocol")}' request")

        val resultData = Intent()
        PendingIntentHandler.setGetCredentialResponse(
                resultData,
                GetCredentialResponse(DigitalCredential(credentialData.toString())),
                providerRequest(requestIntent)
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

    /**
     * What the request UI is rendered from.
     *
     * Unlike iOS, where the OS holds the raw request back until the wallet commits to answering,
     * the picker hands the whole request over with its result — so the protocol requests are in
     * here from the start and there is nothing to approve first.
     */
    fun getRequest(context: Context, intent: Intent): String? {
        val request = PendingIntentHandler.retrieveProviderGetCredentialRequest(intent)
        if (request == null) {
            Log.d(TAG, "intent is not a get credentials action")
            return null
        }

        return JSONObject()
                .put("platform", "android")
                // Null when the caller never set one: a native app asking for a credential for
                // itself has no website to speak for, and identifies itself by its package instead.
                // It is passed through as null rather than blanked, because a wallet that binds a
                // response to the empty string binds it to the wrong thing.
                //
                // Note this is not the same as an origin that cannot be trusted: when an origin *is*
                // set but the caller is not in the privileged allowlist, `getOrigin` throws, and
                // that throw is left to propagate — an unverifiable origin must not reach the wallet
                // looking like an app request.
                .put("origin", request.callingAppInfo.getOrigin(loadAllowedApps(context)) ?: JSONObject.NULL)
                .put("callingPackage", request.callingAppInfo.packageName)
                .put("matcher", storedMatcher(context))
                // Explicitly null rather than omitted: `JSONObject.put` drops a key whose value is
                // null, and the request UI should see that nothing was picked rather than a missing
                // field.
                .put("selectedEntryIds", selectedEntryIds(request)?.let { JSONArray(it) } ?: JSONObject.NULL)
                .put("requests", JSONArray(protocolRequests(intent)))
                .toString()
    }

    /**
     * What the user picked, however the picker reported it.
     *
     * There are two shapes, and they are mutually exclusive: a single credential in
     * `extra.CREDENTIAL_ID`, or a *set* in `extra.CREDENTIAL_SET_*`. Which one arrives depends on
     * what the matcher registered. The multipaz matcher builds sets whenever the runtime supports
     * them, so even a single credential comes back as a set of one, and `selectedEntryId` alone is
     * null even though the user did choose.
     *
     * A set carries one credential per slot the matcher declared, in slot order: a request the user
     * answered with two credentials comes back as two entry ids. Null when nothing was picked.
     */
    private fun selectedEntryIds(request: androidx.credentials.provider.ProviderGetCredentialRequest): List<String>? {
        request.selectedEntryId?.let {
            Log.d(TAG, "picked a single credential entry")
            return listOf(it)
        }

        val credentials = request.selectedCredentialSet?.credentials.orEmpty()
        Log.d(TAG, "no single entry; credential set has ${credentials.size} credential(s)")

        return credentials.map { it.credentialId }.ifEmpty { null }
    }

    private fun providerRequest(intent: Intent) =
            PendingIntentHandler.retrieveProviderGetCredentialRequest(intent)
                    ?: throw IllegalStateException(
                            "The activity was not started to answer a credential request"
                    )

    private fun protocolRequests(intent: Intent): List<JSONObject> {
        val request = providerRequest(intent)

        if (request.credentialOptions.size != 1) {
            throw IllegalStateException(
                    "Expected only one credentialOption in request, found ${request.credentialOptions.size}"
            )
        }

        val credentialOption = request.credentialOptions.first()
        if (credentialOption !is GetDigitalCredentialOption) {
            throw IllegalStateException(
                    "Expected credentialOption to be instance of GetDigitalCredentialOption"
            )
        }

        val requestJson = JSONObject(credentialOption.requestJson)
        // Chrome sends either the current `requests` shape or the deprecated `providers` one, which
        // spells `data` as `request`.
        val entries = requestJson.optJSONArray("requests") ?: requestJson.optJSONArray("providers")

        // Every entry the verifier sent is kept, in its order, protocols this package does not know
        // included: the matcher indexed this list, so dropping from it here would misalign the
        // picked entry. The JS side filters, and remaps the index while it does.
        return buildList {
            for (index in 0 until (entries?.length() ?: 0)) {
                val entry = entries?.optJSONObject(index) ?: continue
                val protocol = entry.optString("protocol")
                val data = if (entry.has("data")) entry.get("data") else entry.opt("request")
                add(JSONObject().put("protocol", protocol).put("data", normalizeData(protocol, data)))
            }
        }
    }

    /**
     * `org-iso-mdoc` carries an object (`{deviceRequest, encryptionInfo}`), OpenID4VP a JSON string.
     * Chrome is not consistent about which of the two it sends for a given protocol, so both are
     * accepted and normalized to the documented shape.
     */
    private fun normalizeData(protocol: String, data: Any?): Any =
            when {
                protocol == "org-iso-mdoc" && data is String -> JSONObject(data)
                protocol == "org-iso-mdoc" -> data ?: JSONObject()
                data is String -> data
                else -> data?.toString() ?: ""
            }

    private fun storedMatcher(context: Context) =
            context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                    .getString(MATCHER_KEY, Matcher.MULTIPAZ.identifier)

    private fun loadMatcher(context: Context, matcher: Matcher) =
            try {
                loadAsset(context, matcher.asset)
            } catch (e: Exception) {
                throw IllegalStateException(
                        "Matcher asset '${matcher.asset}' could not be loaded.",
                        e
                )
            }

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
