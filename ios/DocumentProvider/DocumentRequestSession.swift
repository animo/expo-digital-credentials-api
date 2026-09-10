// `internal`, because the generated ExpoModulesProvider.swift in this target imports it that way and
// mixing implicit access levels for one module is an error.
internal import DigitalCredentialsApi
import Foundation
import IdentityDocumentServices
import IdentityDocumentServicesUI
import Security

/// Drives the two-phase Annex C exchange for a single request.
///
/// Apple only releases the raw `{deviceRequest, encryptionInfo}` payload inside the `sendResponse`
/// closure, i.e. once the wallet commits to answering. So the JS side first renders consent from
/// the parsed request, then calls `approve()` to obtain the raw request, and finally calls
/// `respond(_:)` with the encrypted Annex C response it built.
///
/// This is the only piece of the flow the extension target owns; everything JS talks to lives in the
/// expo module, which reaches this through ``DcApiRequestSession``.
@available(iOS 26.0, *)
final class DocumentRequestSession: DcApiRequestSession, @unchecked Sendable {
    private let context: ISO18013MobileDocumentRequestContext
    private let originURL: URL
    private let lock = NSLock()
    private var approveContinuation: CheckedContinuation<Data, Error>?
    private var responseContinuation: CheckedContinuation<Data, Error>?
    private var didFinish = false

    /// Fails when the OS did not report an origin.
    ///
    /// `requestingWebsiteOrigin` is optional on the OS type, but every request that can be answered
    /// has one: the origin is what `IdentityDocumentWebPresentmentRawRequestValidator` checks the
    /// raw request against, and what C.5 binds the session transcript to. So rather than handing the
    /// wallet a request it could never answer — or, worse, a blank origin it might render or bind —
    /// there is no session, and the caller cancels the request.
    init?(context: ISO18013MobileDocumentRequestContext) {
        guard let originURL = context.requestingWebsiteOrigin else { return nil }

        self.context = context
        self.originURL = originURL
    }

    /// The web origin, serialized the way the browser sends it: `scheme://host`, with the port only
    /// when it is not the scheme's default, and never a path.
    ///
    /// The OS reports the origin as a `URL`, and a URL is not an origin: a hierarchical URL carries a
    /// path, so `absoluteString` hands back `https://example.com/`. That trailing slash is not
    /// cosmetic — ISO/IEC TS 18013-7:2025 C.5 hashes the origin verbatim into the session transcript,
    /// and the verifier hashes the `Origin` header the browser sent it, which has no slash. Binding
    /// the URL form yields a transcript the verifier never computes, and the response it gets back
    /// cannot be decrypted at all.
    ///
    /// Falls back to the URL as-is when it has no scheme or host, which no origin the OS reports
    /// should hit — there is simply nothing better to bind at that point.
    var origin: String {
        guard let components = URLComponents(url: originURL, resolvingAgainstBaseURL: false),
            let scheme = components.scheme,
            // `encodedHost` over `host`, which decodes: an IPv6 host comes back without its brackets
            // and a punycode host percent-decoded, neither of which is what the browser serialized.
            let host = components.encodedHost ?? components.host
        else {
            return originURL.absoluteString
        }

        let defaultPort: Int? = scheme == "https" ? 443 : (scheme == "http" ? 80 : nil)
        guard let port = components.port, port != defaultPort else {
            return "\(scheme)://\(host)"
        }

        return "\(scheme)://\(host):\(port)"
    }

    var requestedDocumentTypes: [String] {
        context.request.presentmentRequests.flatMap { presentment in
            presentment.documentRequestSets.flatMap { set in set.requests.map(\.documentType) }
        }
    }

    /// The parsed request, as the JS side reads it.
    ///
    /// `ISO18013MobileDocumentRequest` is passed through structurally — the requested elements and
    /// their `intentToRetain` included — because before `approve()` this is all the wallet has to
    /// render consent from, and it has no system picker to fall back on.
    var requestJson: String? {
        let presentmentRequests = context.request.presentmentRequests.map { presentmentRequest -> [String: Any] in
            [
                "isMandatory": presentmentRequest.isMandatory,
                "documentRequestSets": presentmentRequest.documentRequestSets.map { set -> [String: Any] in
                    [
                        "documentRequests": set.requests.map { documentRequest -> [String: Any] in
                            [
                                "doctype": documentRequest.documentType,
                                "namespaces": documentRequest.namespaces.mapValues { elements in
                                    elements.mapValues { ["intentToRetain": $0.isRetaining] }
                                },
                            ]
                        },
                    ]
                },
            ]
        }

        let readerAuthentications = context.request.requestAuthentications.map { authentication -> [String: Any] in
            [
                "certificateChain": authentication.authenticationCertificateChain.map {
                    (SecCertificateCopyData($0) as Data).base64EncodedString()
                },
            ]
        }

        let payload: [String: Any] = [
            "platform": "ios",
            "origin": origin,
            "presentmentRequests": presentmentRequests,
            "readerAuthentications": readerAuthentications,
        ]

        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8)
        else {
            // Everything above is JSON-safe, so this is unreachable in practice. If it ever is
            // reached the request is cancelled rather than rendered from a stand-in payload: a
            // screen that cannot say who is asking, or what for, is not one to consent from.
            dcApiLog.error("request: could not encode the parsed request")
            return nil
        }

        return json
    }

    /// Release the raw request after the user approved, and keep the response closure open until
    /// `respond(_:)` is called.
    func approve() async throws -> Data {
        try await withCheckedThrowingContinuation { continuation in
            lock.lock()
            guard approveContinuation == nil, !didFinish else {
                lock.unlock()
                continuation.resume(throwing: DocumentRequestSessionError.alreadyApproved)
                return
            }
            approveContinuation = continuation
            lock.unlock()

            Task { [context, originURL] in
                do {
                    try await context.sendResponse { [weak self] rawRequest in
                        guard let self else { throw DocumentRequestSessionError.cancelled }

                        // Apple's guidance: cross-check the raw request against the parsed request
                        // the consent UI was rendered from before releasing any document.
                        _ = try IdentityDocumentWebPresentmentRawRequestValidator()
                            .validateISO18013MobileDocumentRequest(rawRequest.requestData, origin: originURL)

                        let responseData = try await withCheckedThrowingContinuation {
                            (responseContinuation: CheckedContinuation<Data, Error>) in
                            self.lock.lock()
                            // A cancel that landed after the OS released the request but before
                            // this point has already failed the session — and found no response
                            // continuation to fail. Stored anyway, nothing would ever resume it,
                            // and both the OS and the JS awaiting `approve()` would hang.
                            guard !self.didFinish else {
                                self.lock.unlock()
                                responseContinuation.resume(throwing: DocumentRequestSessionError.cancelled)
                                return
                            }
                            self.responseContinuation = responseContinuation
                            let approveContinuation = self.approveContinuation
                            self.approveContinuation = nil
                            self.lock.unlock()

                            approveContinuation?.resume(returning: rawRequest.requestData)
                        }

                        return ISO18013MobileDocumentResponse(responseData: responseData)
                    }
                    self.finish()
                } catch {
                    self.fail(with: error)
                }
            }
        }
    }

    func respond(_ responseData: Data) throws {
        lock.lock()
        let continuation = responseContinuation
        responseContinuation = nil
        lock.unlock()

        guard let continuation else { throw DocumentRequestSessionError.notApproved }
        continuation.resume(returning: responseData)
    }

    func cancel() {
        fail(with: DocumentRequestSessionError.cancelled)
        DispatchQueue.main.async { [context] in context.cancel() }
    }

    private func finish() {
        lock.lock()
        didFinish = true
        lock.unlock()

        DcApiRequestSessionStore.clear(self)
    }

    private func fail(with error: Error) {
        lock.lock()
        guard !didFinish else {
            lock.unlock()
            return
        }
        didFinish = true
        let approve = approveContinuation
        let response = responseContinuation
        approveContinuation = nil
        responseContinuation = nil
        lock.unlock()

        DcApiRequestSessionStore.clear(self)

        approve?.resume(throwing: error)
        response?.resume(throwing: error)
    }
}

enum DocumentRequestSessionError: Error, LocalizedError {
    case alreadyApproved
    case notApproved
    case cancelled

    var errorDescription: String? {
        switch self {
        case .alreadyApproved: return "The request was already approved"
        case .notApproved: return "The request must be approved before a response can be sent"
        case .cancelled: return "The request was cancelled"
        }
    }
}
