import Foundation

/// The credential request the provider extension is currently showing UI for.
///
/// The extension target owns the `ISO18013MobileDocumentRequestContext` and the ExtensionKit scene,
/// neither of which this pod links, so it hands the session over behind this protocol. That keeps
/// all of the JS-facing API in the expo module — the same one the host app uses — instead of a
/// separate bridge module only the extension has.
///
/// Mirrors `DigitalCredentialsApiSingleton.currentRequestActivity` on Android.
public protocol DcApiRequestSession: AnyObject {
    /// The origin the request was made on behalf of.
    ///
    /// Never optional: a request without one cannot be answered — the origin is bound into both the
    /// raw request validation and the session transcript — so no session is created for it at all.
    var origin: String { get }

    /// The request as the OS parsed it, JSON encoded, in the shape the JS side expects. Everything
    /// the wallet can render consent from — but not the raw request itself, which the OS only
    /// releases once ``approve()`` is called.
    ///
    /// Nil only if the parsed request could not be encoded, which leaves nothing safe to render.
    var requestJson: String? { get }

    /// Commit to answering the request.
    ///
    /// - Returns: the raw request data the OS released, i.e. the ISO/IEC TS 18013-7:2025 C.2
    ///   `{deviceRequest, encryptionInfo}` payload.
    func approve() async throws -> Data

    /// Complete the request with the CBOR `EncryptedResponse` (C.3), and nothing around it.
    ///
    /// Not the `{ "response": ... }` object: iOS builds that itself, base64url encoding these bytes
    /// into its `response` member. The JS side answers with the object — the same one Android takes
    /// — and the module unwraps it before it gets here.
    func respond(_ responseData: Data) throws

    func cancel()
}

/// Only one request is in flight per extension process, so a single slot is enough.
///
/// Locked: the scene writes it on the main actor and the module reads it from its own queue.
public enum DcApiRequestSessionStore {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var session: DcApiRequestSession?

    public static var current: DcApiRequestSession? {
        get { lock.withLock { session } }
        set { lock.withLock { session = newValue } }
    }

    /// Empties the slot once `finished` is done, so the finished session — its request context and
    /// the raw request with it — is not kept alive in a memory-capped extension. Left alone when a
    /// newer request has taken the slot since.
    public static func clear(_ finished: DcApiRequestSession) {
        lock.withLock {
            if session === finished { session = nil }
        }
    }
}
