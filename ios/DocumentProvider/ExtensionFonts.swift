import CoreText
import Foundation

/// Installs the fonts the config plugin's `ios.fonts` names, out of the app's bundle.
///
/// `UIAppFonts` installs fonts for the bundle that declares them, and the extension is a separate
/// bundle — so none of the app's fonts exist here and the request UI renders in the system font.
///
/// The files are read where the app already ships them, one directory up from this appex, rather
/// than copied into it: the same bytes, not shipped twice. Registration is per process and costs a
/// few milliseconds for the handful of faces a request UI draws with.
enum ExtensionFonts {
    /// Registers every named font, skipping the ones that fail. A missing font is a wrong typeface,
    /// never a reason not to show the request.
    static func register() {
        guard let names = Bundle.main.object(forInfoDictionaryKey: fontsInfoPlistKey) as? [String], !names.isEmpty
        else { return }

        guard let appBundle = hostAppBundle() else {
            dcApiLog.error("fonts: no containing app bundle — the request UI renders in the system font")
            return
        }

        var registered = 0

        for name in names {
            guard let url = fontUrl(for: name, in: appBundle) else {
                dcApiLog.error("fonts: '\(name, privacy: .public)' is not in the app bundle")
                continue
            }

            var error: Unmanaged<CFError>?
            if CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
                registered += 1
                continue
            }

            // Registering the same file twice is not a failure — it is already usable.
            let failure = error?.takeRetainedValue()
            if let failure, CFErrorGetCode(failure) == CTFontManagerError.alreadyRegistered.rawValue {
                registered += 1
                continue
            }

            dcApiLog.error(
                "fonts: could not register '\(name, privacy: .public)': \(failure?.localizedDescription ?? "unknown error", privacy: .public)"
            )
        }

        dcApiLog.notice("fonts: registered \(registered, privacy: .public)/\(names.count, privacy: .public)")
    }

    /// The app the extension is embedded in.
    ///
    /// `Bundle.main` is the appex — `…/Wallet.app/Extensions/DocumentProvider.appex` — so the app is
    /// found by walking up to the enclosing `.app` wrapper rather than by counting directories.
    private static func hostAppBundle() -> Bundle? {
        var url = Bundle.main.bundleURL

        for _ in 0..<4 {
            url.deleteLastPathComponent()
            if url.pathExtension == "app" { return Bundle(url: url) }
        }

        return nil
    }

    /// Font file names are relative to the app's resources, which is where every plugin that adds
    /// one puts it.
    private static func fontUrl(for name: String, in bundle: Bundle) -> URL? {
        if let resourceUrl = bundle.resourceURL {
            let url = resourceUrl.appendingPathComponent(name)
            if FileManager.default.fileExists(atPath: url.path) { return url }
        }

        return bundle.url(forResource: name, withExtension: nil)
    }
}

/// Written by the config plugin from `ios.fonts`.
private let fontsInfoPlistKey = "EXPO_DC_API_FONTS"
