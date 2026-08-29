// `internal`, because the generated ExpoModulesProvider.swift in this target imports it that way and
// mixing implicit access levels for one module is an error.
internal import DigitalCredentialsApi
import ExtensionKit
import IdentityDocumentServices
import IdentityDocumentServicesUI
import SwiftUI

/// Background behind the request UI, from the config plugin's `ios.backgroundColor`, one colour per
/// appearance. Empty means the system background, which follows the device.
///
/// Visible before the JS has rendered and wherever the React Native view is transparent — but also
/// behind the sheet's title, which is why it is worth matching to what the registered screen paints:
/// the strip around the title is this colour, and the screen below it is the screen's own.
private let backgroundColorHexLight = "{{BACKGROUND_COLOR_LIGHT}}"
private let backgroundColorHexDark = "{{BACKGROUND_COLOR_DARK}}"

/// Identity Document Provider extension (ISO/IEC TS 18013-7:2025 Annex C over the W3C Digital
/// Credentials API).
///
/// The scene hosts the wallet's own React Native approval UI; the response itself is built in JS and
/// handed back through the `DigitalCredentialsApi` expo module, the same one the host app uses.
@main
struct IdentityDocumentProviderExtension: IdentityDocumentProvider {
    init() {
        dcApiLog.notice("extension: principal object created")

        // The OS runs this on the main thread before the scene, which is the only point early
        // enough to set up React Native — see `ExtensionReactNative.boot()`. Fonts go first: React
        // Native resolves a family the moment it lays text out.
        MainActor.assumeIsolated {
            ExtensionFonts.register()
            ExtensionReactNative.boot()
        }
    }

    var body: some IdentityDocumentRequestScene {
        ISO18013MobileDocumentRequestScene { context in
            DigitalCredentialsRequestView(requestContext: context)
                .modifier(SceneBackground())
                .ignoresSafeArea(edges: .bottom)
        }
    }

    /// The OS asking the provider to refresh what it can present. Nothing to do: the registration
    /// store is the only record of that, the app maintains it directly, and this package keeps no
    /// copy of the credentials to rebuild it from.
    func performRegistrationUpdates() async {
        dcApiLog.notice("extension: registration update requested; registrations are maintained by the app")
    }
}

/// Paints the configured background for the appearance the scene is actually being shown in.
///
/// Read from the environment rather than resolved as a dynamic `UIColor`: the extension's remote UI
/// process has no trait collection to resolve one against this early, which aborts.
private struct SceneBackground: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        let hex = colorScheme == .dark ? backgroundColorHexDark : backgroundColorHexLight

        return content.background(Color(hex: hex) ?? Color(uiColor: .systemBackground))
    }
}

extension Color {
    /// `#RRGGBB` or `#RRGGBBAA`, the form the config plugin validates.
    fileprivate init?(hex: String) {
        var value = hex.trimmingCharacters(in: .whitespaces)
        if value.hasPrefix("#") { value.removeFirst() }

        guard value.count == 6 || value.count == 8, let number = UInt64(value, radix: 16) else { return nil }

        let alphaShift = value.count == 8 ? 8 : 0
        self.init(
            .sRGB,
            red: Double((number >> (16 + alphaShift)) & 0xFF) / 255,
            green: Double((number >> (8 + alphaShift)) & 0xFF) / 255,
            blue: Double((number >> alphaShift) & 0xFF) / 255,
            opacity: value.count == 8 ? Double(number & 0xFF) / 255 : 1
        )
    }
}
