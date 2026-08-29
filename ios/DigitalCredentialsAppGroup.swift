import Foundation

/// The app group container the app and the provider extension share.
///
/// The extension is a separate process with its own sandbox, so anything both have to read — a
/// wallet database, most of all — has to live in a shared container rather than in either one's own.
/// This package stores nothing there itself: it only resolves the path, from the
/// `ANIMO_DC_API_APP_GROUP` Info.plist key the config plugin writes into both targets.
public enum DigitalCredentialsAppGroup {
    public static let infoPlistKey = "ANIMO_DC_API_APP_GROUP"

    /// `Bundle.main` is the app in one process and the extension in the other, which is why the
    /// plugin writes the key into both.
    public static var identifier: String? {
        Bundle.main.object(forInfoDictionaryKey: infoPlistKey) as? String
    }

    public static var containerUrl: URL? {
        guard let identifier else { return nil }

        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier)
    }
}
