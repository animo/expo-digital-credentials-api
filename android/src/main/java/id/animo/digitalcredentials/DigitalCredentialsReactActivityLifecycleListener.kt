package id.animo.digitalcredentials

import android.app.Activity
import android.os.Bundle
import android.util.Log
import com.google.android.gms.identitycredentials.IntentHelper
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class DigitalCredentialsReactActivityLifecycleListener : ReactActivityLifecycleListener {
    override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
        val intent = activity?.intent
        Log.d("DigitalCredentialsApi", "onCreate called")

        // Somehow the IntentHelper is not working...
        if (intent != null && DigitalCredentialsApiSingleton.isGetCredentialRequestIntent(intent)) {
            Log.d("DigitalCredentialsApi", "onCreate: received get credentials request intent")
            DigitalCredentialsApiSingleton.intent = activity.intent
            DigitalCredentialsApiSingleton.isPending = true
        }
    }
}
