package id.animo.digitalcredentials

import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DigitalCredentialsApiModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DigitalCredentialsApi")

    Events("onRequest")

    AsyncFunction("registerCredentials") Coroutine
            { credentialBytes: String ->
              val context =
                      appContext.reactContext?.applicationContext
                              ?: throw IllegalStateException(
                                      "React application context is not available"
                              )

              DigitalCredentialHandler().registerCredentials(context, credentialBytes.toByteArray())
              return@Coroutine
            }
  }
}
