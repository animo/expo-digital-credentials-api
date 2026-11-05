import Foundation

/// The credential request the provider extension is currently showing UI for.
///
/// The extension target owns the request context and the ExtensionKit scene,
/// neither of which this pod links, so it hands the session over behind this protocol. That keeps
/// all of the JS-facing API in the expo module — the same one the host app uses — instead of a
/// separate bridge module only the extension has.
///
/// Mirrors `DigitalCredentialsApiSingleton.currentRequestActivity` on Android.
public protocol DcApiRequestSession: AnyObject {
    /// The origin the request was made on behalf of.
    ///
    /// Never optional: the response is bound to it, so a request without one gets no session.
    var origin: String { get }

    /// The protocol the request came in over, e.g. `openid4vp-v1-signed`. Responses must use it.
    var exchangeProtocol: String { get }

    /// The request, JSON encoded in the shape the JS side expects. Nil when it could not be encoded.
    var requestJson: String? { get }

    /// Commit to answering the request.
    ///
    /// - Returns: the C.2 `{deviceRequest, encryptionInfo}` payload the OS released. Throws for raw
    ///   requests, which carry it in ``requestJson`` from the start.
    func approve() async throws -> Data

    /// Complete the request: for `org-iso-mdoc` with the bare CBOR `EncryptedResponse` (iOS wraps it
    /// in the C.3 object itself), for OpenID4VP with the JSON encoded authorization response.
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
