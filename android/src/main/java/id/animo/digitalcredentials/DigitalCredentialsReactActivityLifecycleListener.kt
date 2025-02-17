package id.animo.digitalcredentials

import android.app.Activity
import android.os.Bundle
import android.util.Log
import com.google.android.gms.identitycredentials.IntentHelper
import expo.modules.core.interfaces.ReactActivityLifecycleListener

class DigitalCredentialsReactActivityLifecycleListener : ReactActivityLifecycleListener {
    override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
        val intent = activity?.intent

        // Somehow the IntentHelper is not working...
        if (intent != null && intent.action == DigitalCredentialsApiSingleton.ACTION) {
            Log.d("DigitalCredentialsApi", "received get credentials request intent")
            DigitalCredentialsApiSingleton.intent = activity.intent
            DigitalCredentialsApiSingleton.isPending = true
        }
    }

    //    override fun onNewIntent(intent: Intent): Boolean {
    //        val request = IntentHelper.extractGetCredentialRequest(intent)
    //        Log.i("DigitalCredentialsApi", "Received request $request")
    //
    //        if (request != null) {
    //            val parsedRequest = DigitalCredentialHandler().getRequest(intent)
    //            Log.i("DigitalCredentialsApi", "Received request $parsedRequest")
    //            return true
    //        }
    //
    //        return false
    //    }
}
