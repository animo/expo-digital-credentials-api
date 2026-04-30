package id.animo.digitalcredentials

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class DigitalCredentialsApiCreateCredentialActivity : ReactActivity() {

    override fun getMainComponentName(): String = "DigitalCredentialsApiCreateCredentialActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Enable edge-to-edge display
        window.apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                setDecorFitsSystemWindows(false)
            } else {
                @Suppress("DEPRECATION")
                decorView.systemUiVisibility =
                        (View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
            }
            navigationBarColor = android.graphics.Color.TRANSPARENT
            statusBarColor = android.graphics.Color.TRANSPARENT
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)

        Log.d("DigitalCredentialsApi", "onNewIntent (create)")
        setIntent(intent)

        // Force a re-render of the React component
        recreate()
    }

    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return object :
                DefaultReactActivityDelegate(
                        this,
                        mainComponentName,
                        fabricEnabled
                ) {

            override fun getLaunchOptions() =
                    Bundle().apply {
                        putString("request", DigitalCredentialsApiSingleton.getCreateRequest(context, intent))
                    }
        }
    }
}
