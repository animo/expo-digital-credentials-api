package id.animo.digitalcredentials

import android.content.Intent
import android.content.res.Configuration
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.facebook.react.ReactDelegate
import com.facebook.react.modules.core.DefaultHardwareBackBtnHandler

/**
 * Hosts the credential request UI the credential picker launches into.
 *
 * Unlike a `ReactActivity` this does not run the app's bundle: the UI has its own entry point and
 * its own react host, so it stays independent of the app's navigation — the same split the iOS
 * provider extension has by construction.
 *
 * Neither the base class nor the interface is a free choice, and both only bite once the activity
 * resumes: `ReactDelegate.onHostResume` casts to `DefaultHardwareBackBtnHandler`, and expo's
 * `AppContext.onHostResume` checks for an `AppCompatActivity`. Both throw rather than degrade, which
 * is also why `Theme.Transparent` descends from `Theme.AppCompat`.
 */
class DigitalCredentialsApiActivity : AppCompatActivity(), DefaultHardwareBackBtnHandler {

    private lateinit var reactDelegate: ReactDelegate

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        DigitalCredentialsApiSingleton.currentRequestActivity = this
        android.util.Log.d("DigitalCredentialsApi", "request activity started by action '${intent.action}'")

        // Edge-to-edge: the component renders as a sheet over the requesting app.
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

        reactDelegate =
                ReactDelegate(
                        this,
                        DcApiReactHost.get(application),
                        DC_API_COMPONENT_NAME,
                        launchOptions()
                )
        reactDelegate.loadApp()
        // `ReactDelegate` starts the surface but never attaches it — `ReactActivityDelegate` is what
        // normally does this. Without it React renders into a view that is not in the window, and
        // the activity is simply transparent.
        setContentView(reactDelegate.reactRootView)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)

        // The picker reuses the activity for a new request, and the component reads the request from
        // its props.
        setIntent(intent)
        recreate()
    }

    override fun onResume() {
        super.onResume()
        reactDelegate.onHostResume()
    }

    override fun onPause() {
        super.onPause()
        reactDelegate.onHostPause()
    }

    override fun onDestroy() {
        super.onDestroy()

        if (DigitalCredentialsApiSingleton.currentRequestActivity === this) {
            DigitalCredentialsApiSingleton.currentRequestActivity = null
        }
        reactDelegate.onHostDestroy()
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (!reactDelegate.onBackPressed()) {
            super.onBackPressed()
        }
    }

    /** React handing the back press back to the activity, once JS has declined to consume it. */
    @Suppress("DEPRECATION")
    override fun invokeDefaultOnBackPressed() {
        super.onBackPressed()
    }

    // The rest of what `ReactDelegate` expects an activity to forward. Dev support needs the key
    // events — without them the reload shortcut and the dev menu do nothing — and modules that
    // start another activity need the result.
    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        reactDelegate.onActivityResult(requestCode, resultCode, data, true)
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        reactDelegate.onUserLeaveHint()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        reactDelegate.onWindowFocusChanged(hasFocus)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        reactDelegate.onConfigurationChanged(newConfig)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean =
            reactDelegate.onKeyDown(keyCode, event) || super.onKeyDown(keyCode, event)

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean =
            reactDelegate.shouldShowDevMenuOrReload(keyCode, event) || super.onKeyUp(keyCode, event)

    override fun onKeyLongPress(keyCode: Int, event: KeyEvent): Boolean =
            reactDelegate.onKeyLongPress(keyCode) || super.onKeyLongPress(keyCode, event)

    private fun launchOptions() =
            Bundle().apply {
                putString("request", DigitalCredentialsApiSingleton.getRequest(this@DigitalCredentialsApiActivity, intent))
            }

    private companion object {
        /** Must match `registerDcApiScreen` on the JS side. */
        const val DC_API_COMPONENT_NAME = "DigitalCredentialsApi"
    }
}
