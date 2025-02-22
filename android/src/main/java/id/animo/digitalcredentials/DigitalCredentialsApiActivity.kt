package id.animo.digitalcredentials

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.annotation.RequiresApi
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled

class DigitalCredentialsApiActivity : ReactActivity() {

    override fun getMainComponentName(): String = "DigitalCredentialsApiActivity"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Enable edge-to-edge display
        window.apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                setDecorFitsSystemWindows(false)
            }
            navigationBarColor = android.graphics.Color.TRANSPARENT
            statusBarColor = android.graphics.Color.TRANSPARENT
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)

        Log.d("DigitalCredentialsApi", "onNewIntent")
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
                        putString("request", DigitalCredentialsApiSingleton.getRequest(context, intent))
                    }

            override fun onNewIntent(intent: Intent?): Boolean {
                return super.onNewIntent(intent)
            }
        }
    }
}
