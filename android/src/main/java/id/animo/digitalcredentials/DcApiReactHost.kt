package id.animo.digitalcredentials

import android.app.Application
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.util.Log
import com.facebook.react.ReactHost
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.JSBundleLoader
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.defaults.DefaultComponentsRegistry
import com.facebook.react.defaults.DefaultReactHostDelegate
import com.facebook.react.defaults.DefaultTurboModuleManagerDelegate
import com.facebook.react.fabric.ComponentFactory
import com.facebook.react.runtime.ReactHostImpl
import com.facebook.react.runtime.hermes.HermesInstance
import expo.modules.adapters.react.ModuleRegistryAdapter
import expo.modules.adapters.react.ReactModuleRegistryProvider
import expo.modules.core.interfaces.Package
import expo.modules.kotlin.ExpoModulesHelper
import expo.modules.kotlin.ModulesProvider

/** Asset the config plugin's gradle task writes the release bundle to. */
private const val BUNDLE_ASSET = "dc-api.android.bundle"

/** Package of expo-updates' classes, left out of the request UI. */
private const val EXPO_UPDATES_PACKAGE = "expo.modules.updates."

/** Manifest meta-data the config plugin writes, matching the plugin's `entry` option. */
private const val ENTRY_META_DATA = "id.animo.digitalcredentials.ENTRY"
private const val DEFAULT_ENTRY = "dc-api/index"

/**
 * React host for the credential request UI.
 *
 * It gets its own host because the UI is bundled separately from the app, and `DefaultReactHost`
 * memoizes a single instance — the app's. In debug builds the bundle comes from Metro, so the UI
 * reloads without a rebuild, exactly like the app.
 */
object DcApiReactHost {
    private var host: ReactHost? = null

    @OptIn(UnstableReactNativeAPI::class)
    fun get(application: Application): ReactHost {
        host?.let {
            return it
        }

        val componentFactory = ComponentFactory()
        DefaultComponentsRegistry.register(componentFactory)

        val delegate =
                DefaultReactHostDelegate(
                        jsMainModulePath = entry(application),
                        jsBundleLoader =
                                JSBundleLoader.createAssetLoader(
                                        application,
                                        "assets://$BUNDLE_ASSET",
                                        true
                                ),
                        reactPackages = packages(application),
                        jsRuntimeFactory = HermesInstance(),
                        turboModuleManagerDelegateBuilder =
                                DefaultTurboModuleManagerDelegate.Builder()
                )

        return ReactHostImpl(
                        application,
                        delegate,
                        componentFactory,
                        true /* allowPackagerServerAccess */,
                        isDebuggable(application)
                )
                .also { host = it }
    }

    /**
     * The same packages the app links. Both `PackageList` (generated into the app by autolinking)
     * and `ExpoModulesPackage` (owned by the `expo` package, which this module does not depend on)
     * are only reachable reflectively from here.
     */
    private fun packages(application: Application): List<ReactPackage> {
        val autolinked =
                runCatching {
                            val packageList = Class.forName("com.facebook.react.PackageList")
                            val instance =
                                    packageList
                                            .getConstructor(Application::class.java)
                                            .newInstance(application)

                            @Suppress("UNCHECKED_CAST")
                            packageList.getMethod("getPackages").invoke(instance) as
                                    List<ReactPackage>
                        }
                        // Not fatal on its own — the request UI can still start — but every module
                        // it uses will then be missing, which is far easier to chase from here.
                        .onFailure { Log.w("DigitalCredentialsApi", "could not load the autolinked packages", it) }
                        .getOrDefault(emptyList())

        val expoModules =
                runCatching { expoModulesPackage() }
                        .onFailure { Log.w("DigitalCredentialsApi", "could not load the Expo modules", it) }
                        .getOrNull()

        // Autolinking has generated `ExpoModulesPackage` into `PackageList` under more than one
        // package name over the years, so match on the simple name.
        return listOfNotNull(expoModules) +
                autolinked.filterNot { it.javaClass.simpleName == "ExpoModulesPackage" }
    }

    /**
     * What `ExpoModulesPackage` provides, minus expo-updates: the same split the iOS extension makes
     * at link time. Its module serves the controller the app's own react host starts, and the
     * request UI's process never creates that host, so its constants throw. `expo` reads them as
     * soon as it loads (through expo-asset and expo-constants), which takes the request UI down
     * before it renders. Without the module `ExpoUpdates` is not installed here at all, exactly as in
     * an app without expo-updates.
     */
    private fun expoModulesPackage(): ReactPackage {
        // `ExpoModulesPackage.packageList`, in the order the app registers the packages in.
        val companion = Class.forName("expo.modules.ExpoModulesPackage").getField("Companion").get(null)
        @Suppress("UNCHECKED_CAST")
        val packages = companion.javaClass.getMethod("getPackageList").invoke(companion) as List<Package>
        val modules = checkNotNull(ExpoModulesHelper.modulesProvider) { "the Expo modules list is missing" }

        return ModuleRegistryAdapter(
                ReactModuleRegistryProvider(packages.filterNot { isExcluded(it.javaClass) }, null),
                object : ModulesProvider {
                    override fun getModulesMap() = modules.getModulesMap().filterKeys { !isExcluded(it) }

                    override fun getServices() = modules.getServices().filterNot { isExcluded(it) }
                }
        )
    }

    private fun isExcluded(type: Class<*>) = type.name.startsWith(EXPO_UPDATES_PACKAGE)

    private fun entry(application: Application): String {
        val metaData =
                application.packageManager
                        .getApplicationInfo(application.packageName, PackageManager.GET_META_DATA)
                        .metaData
        return metaData?.getString(ENTRY_META_DATA) ?: DEFAULT_ENTRY
    }

    private fun isDebuggable(application: Application) =
            (application.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
}
