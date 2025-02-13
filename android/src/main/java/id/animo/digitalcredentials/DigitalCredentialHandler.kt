package id.animo.digitalcredentials

import android.content.Context
import com.google.android.gms.identitycredentials.IdentityCredentialManager
import com.google.android.gms.identitycredentials.RegistrationRequest
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

class DigitalCredentialHandler() {
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
                                android.util.Log.e(
                                        "DigitalCredential",
                                        "Registration failed",
                                        exception
                                )

                                android.util.Log.e(
                                        "DigitalCredential",
                                        "Error message: ${exception.message}"
                                )

                                android.util.Log.e("DigitalCredential", "Cause: ${exception.cause}")

                                android.util.Log.e(
                                        "DigitalCredential",
                                        "Stack trace: ${exception.stackTraceToString()}"
                                )

                                continuation.resumeWithException(exception)
                        }
        }

        private fun loadMatcher(context: Context): ByteArray {
                val stream = context.assets.open("openid4vp.wasm")
                val matcher = ByteArray(stream.available())
                stream.read(matcher)
                stream.close()
                return matcher
        }
}
