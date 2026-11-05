// `internal`, because the generated ExpoModulesProvider.swift in this target imports it that way and
// mixing implicit access levels for one module is an error.
internal import DigitalCredentialsApi
import Foundation
import IdentityDocumentServices
import IdentityDocumentServicesUI

// The iOS 27.3 SDK ships with Swift 6.4.2. Older Xcodes build the parsed Annex C scene only.
#if compiler(>=6.4.2)

    /// A raw Annex C or OpenID4VP request from iOS 27.3, handed over in full.
    @available(iOS 27.3, *)
    final class RawRequestSession: DcApiRequestSession, @unchecked Sendable {
        let origin: String
        let exchangeProtocol: String
        private let requestData: Data
        private let send: @Sendable (Data) -> Void
        private let cancelRequest: @Sendable () -> Void
        private let lock = NSLock()
        private var didFinish = false

        /// Fails when the OS did not report an origin, which the response is bound to.
        private init?(
            originURL: URL?,
            exchangeProtocol: String,
            requestData: Data,
            send: @escaping @Sendable (Data) -> Void,
            cancel: @escaping @Sendable () -> Void
        ) {
            guard let originURL else { return nil }

            self.origin = webOrigin(originURL)
            self.exchangeProtocol = exchangeProtocol
            self.requestData = requestData
            self.send = send
            self.cancelRequest = cancel
        }

        /// Answered with the CBOR `EncryptedResponse`, which iOS wraps in the C.3 response object.
        convenience init?(context: ISO18013MobileDocumentRawRequestContext) {
            self.init(
                originURL: context.requestingWebsiteOrigin,
                exchangeProtocol: "org-iso-mdoc",
                requestData: context.requestData,
                send: { context.sendResponse(ISO18013MobileDocumentResponse(responseData: $0)) },
                cancel: { context.cancel() }
            )
        }

        /// Answered with the JSON encoded authorization response object.
        convenience init?(context: OpenID4VPRawRequestContext) {
            let exchangeProtocol: String
            switch context.exchangeProtocol {
            case .unsignedV1: exchangeProtocol = "openid4vp-v1-unsigned"
            case .signedV1: exchangeProtocol = "openid4vp-v1-signed"
            case .multisignedV1: exchangeProtocol = "openid4vp-v1-multisigned"
            @unknown default: exchangeProtocol = context.exchangeProtocol.rawValue
            }

            self.init(
                originURL: context.requestingWebsiteOrigin,
                exchangeProtocol: exchangeProtocol,
                requestData: context.requestData,
                send: { context.sendResponse(OpenID4VPRawRequestContext.Response(responseData: $0)) },
                cancel: { context.cancel() }
            )
        }

        /// The request's `data` member stays a JSON string, which the JS side parses.
        var requestJson: String? {
            guard let data = String(data: requestData, encoding: .utf8) else {
                dcApiLog.error("request: the raw request is not UTF-8")
                return nil
            }

            let payload: [String: Any] = [
                "platform": "ios",
                "kind": "raw",
                "protocol": exchangeProtocol,
                "origin": origin,
                "data": data,
            ]

            guard let encoded = try? JSONSerialization.data(withJSONObject: payload) else { return nil }
            return String(data: encoded, encoding: .utf8)
        }

        func approve() async throws -> Data {
            throw RawRequestSessionError.nothingToApprove
        }

        func respond(_ responseData: Data) throws {
            guard markFinished() else { throw DocumentRequestSessionError.cancelled }

            send(responseData)
        }

        func cancel() {
            guard markFinished() else { return }

            DispatchQueue.main.async { [cancelRequest] in cancelRequest() }
        }

        /// False when the request was already answered or cancelled.
        private func markFinished() -> Bool {
            let wasFinished = lock.withLock {
                defer { didFinish = true }
                return didFinish
            }
            if !wasFinished { DcApiRequestSessionStore.clear(self) }

            return !wasFinished
        }
    }

    enum RawRequestSessionError: Error, LocalizedError {
        case nothingToApprove

        var errorDescription: String? { "A raw request is complete from the start, so there is nothing to approve" }
    }

#endif
