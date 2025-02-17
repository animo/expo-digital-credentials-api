package id.animo.ausweissdk

import android.content.Context
import android.util.Log
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import id.animo.digitalcredentials.DigitalCredentialsReactActivityLifecycleListener

class DigitalCredentialsApiPackage : Package {
    override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> {
        Log.d("DigitalCredentialsApi", "createLifecycleListeners")
        return listOf(DigitalCredentialsReactActivityLifecycleListener())
    }
}