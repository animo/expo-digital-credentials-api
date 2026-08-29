// `internal`, because the generated ExpoModulesProvider.swift in this target imports these that way
// and mixing implicit access levels for one module is an error.
internal import DigitalCredentialsApi
internal import Expo
import IdentityDocumentServices
import IdentityDocumentServicesUI
import React
import ReactAppDependencyProvider
import SwiftUI
import os

private let bundleRoot = "{{BUNDLE_ROOT}}"

/// Everything this extension logs, under one subsystem so it can be filtered without guessing at
/// process names. Read it in Console.app with the device selected, filtering on
/// `id.animo.digitalcredentials` — `log stream` cannot target a device.
///
/// The usual React Native channels do not work in an extension — LogBox needs a window it does not
/// own and the dev menu is unreachable — so this log is where a failure shows up.
let dcApiLog = Logger(subsystem: "id.animo.digitalcredentials", category: "extension")

final class ExtensionReactNativeDelegate: ExpoReactNativeFactoryDelegate {
    override func sourceURL(for bridge: RCTBridge) -> URL? {
        bundleURL()
    }

    override func bundleURL() -> URL? {
        #if DEBUG
            // Metro when it is reachable, so extension JS can be reloaded without a rebuild.
            let settings = RCTBundleURLProvider.sharedSettings()
            #if targetEnvironment(simulator)
                if settings.jsLocation?.isEmpty != false {
                    settings.jsLocation = "localhost"
                }
            #endif

            if let url = settings.jsBundleURL(forBundleRoot: bundleRoot), !url.isFileURL {
                dcApiLog.notice("bundle: Metro \(url.absoluteString, privacy: .public)")
                return url
            }

            // `RCTBundleURLProvider` probes `<host>:<port>/status` first and falls back to a file
            // URL when that fails, so this is also what an unreachable or blocked packager looks
            // like. `jsLocation` comes from `ip.txt` in this bundle, written at build time.
            dcApiLog.notice("bundle: Metro unreachable at \(settings.jsLocation ?? "<no ip.txt>", privacy: .public)")
        #endif

        let embedded = Bundle.main.url(forResource: "main", withExtension: "jsbundle")
        dcApiLog.notice("bundle: embedded \(embedded?.lastPathComponent ?? "missing", privacy: .public)")

        return embedded
    }
}

/// React Native boots once per extension process, and the host has to outlive the SwiftUI view that
/// shows it.
@MainActor
enum ExtensionReactNative {
    static let delegate = ExtensionReactNativeDelegate()

    static let factory: ExpoReactNativeFactory = {
        // Order matters, and matches the app's generated AppDelegate: the factory installs React
        // Native's feature-flag overrides while initialising, and that aborts the process if any
        // flag has already been read.
        dcApiLog.notice("react: building the factory")
        let factory = ExpoReactNativeFactory(delegate: delegate)
        delegate.dependencyProvider = RCTAppDependencyProvider()
        dcApiLog.notice("react: factory ready")
        return factory
    }()

    /// Build the factory before anything else in the process can touch React.
    ///
    /// The host app does this from `application(_:didFinishLaunchingWithOptions:)`; the extension's
    /// equivalent is the principal object's initialiser, which the OS runs before the scene. Leaving
    /// it until the scene asks for a root view is too late: whatever ran in between (reading the dev
    /// bundle URL, for one) may have read a feature flag, and the override then throws
    /// `Feature flags were accessed before being overridden` and aborts.
    static func boot() {
        _ = factory
    }
}

/// Owns the one request in flight, so the session is created exactly once per presented scene.
@available(iOS 26.0, *)
@MainActor
final class RequestModel: ObservableObject {
    /// Nil when the request cannot be answered at all, which today means the OS reported no origin.
    /// The request is cancelled instead of being shown: see ``DocumentRequestSession/init(context:)``.
    let session: DocumentRequestSession?

    init(context: ISO18013MobileDocumentRequestContext) {
        guard let session = DocumentRequestSession(context: context) else {
            dcApiLog.error("request: no origin — cancelling, there is nothing that could be answered")
            context.cancel()

            self.session = nil
            DcApiRequestSessionStore.current = nil
            return
        }

        self.session = session
        // The expo module answers JS from here; nothing else in this target is JS-facing.
        DcApiRequestSessionStore.current = session

        // Quoted: the origin is bound into the session transcript verbatim, so a trailing slash or
        // a stray path is the difference between a response the verifier can decrypt and one it
        // cannot.
        dcApiLog.notice(
            "request: origin='\(session.origin, privacy: .public)' docTypes=\(session.requestedDocumentTypes.joined(separator: ","), privacy: .public)"
        )
    }
}

/// Hosts the wallet's React Native request UI inside the provider extension's scene.
@available(iOS 26.0, *)
struct DigitalCredentialsRequestView: View {
    @StateObject private var model: RequestModel

    init(requestContext: ISO18013MobileDocumentRequestContext) {
        _model = StateObject(wrappedValue: RequestModel(context: requestContext))
    }

    var body: some View {
        ReactNativeRootView(model: model)
    }
}

/// The React Native surface. Deliberately dumb: the registered screen owns everything the user sees.
@available(iOS 26.0, *)
private struct ReactNativeRootView: UIViewRepresentable {
    let model: RequestModel

    func makeUIView(context: Context) -> UIView {
        // Touch the factory before the delegate: see `ExtensionReactNative.boot()`.
        let factory = ExtensionReactNative.factory

        guard ExtensionReactNative.delegate.bundleURL() != nil else {
            // Without a bundle there is nothing to approve with, and nothing to render either.
            dcApiLog.error("react: no JS bundle — start Metro, or rebuild with an embedded bundle")
            return UIView()
        }

        // A JSON string, exactly like the Android host passes: the raw request is not in it, since
        // the OS only releases that once the wallet approves. Both nil cases — no session, or a
        // request that would not encode — have already cancelled the request, so there is only an
        // empty view left to return.
        guard let requestJson = model.session?.requestJson else {
            model.session?.cancel()
            return UIView()
        }

        let props: [String: Any] = ["request": requestJson]

        // NOTE: `RCTRootView(bundleURL:moduleName:…)` is legacy-architecture only. With the New
        // Architecture it hands back a view that segfaults the moment it is added to the hierarchy,
        // so the root view has to come from the factory that sets up the bridgeless host.
        let view = factory.rootViewFactory.view(
            withModuleName: "DigitalCredentialsApi",
            initialProperties: props
        )

        return view

        // NOTE: do not assign a dynamic UIColor as the background here. Resolving one needs a trait
        // collection, and in the extension's remote UI process the view has none yet at this point,
        // which aborts with a UITraitCollection assertion. The scene sets the background in SwiftUI.
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}
