import ExpoModulesCore

#if canImport(IdentityDocumentServices)
    import IdentityDocumentServices
#endif

/// Everything the OS needs to match a document. It is all it gets: the credential itself never
/// leaves the app, and this package keeps no copy of it.
struct DocumentRegistrationRecord: Record {
    @Field var documentIdentifier: String = ""
    @Field var documentType: String = ""
    @Field var supportedAuthorityKeyIdentifiers: [String] = []
    @Field var invalidationDate: Date?
}

/// The single JS-facing native module, in both processes: the host app registers documents with it,
/// and the provider extension answers requests through it. On iOS < 26 every entry point throws.
public final class DigitalCredentialsApiModule: Module {
    public func definition() -> ModuleDefinition {
        Name("DigitalCredentialsApi")

        Function("isSupported") { () -> Bool in
            if #available(iOS 26.0, *) { return true }
            return false
        }

        AsyncFunction("getRegistrationStatus") { () -> String in
            guard #available(iOS 26.0, *) else { return "notSupported" }

            switch await IdentityDocumentProviderRegistrationStore().status {
            case .authorized: return "authorized"
            case .notAuthorized: return "notAuthorized"
            case .notDetermined: return "notDetermined"
            default: return "notSupported"
            }
        }

        /// Replaces the full set of registrations. The first call triggers the system permission
        /// prompt, and throws if the user denies it.
        AsyncFunction("registerDocuments") { (records: [DocumentRegistrationRecord]) in
            guard #available(iOS 26.0, *) else {
                throw UnsupportedIosVersionException()
            }

            // Built up front: a value rejected halfway through must not leave the store emptied of
            // what it held before.
            let registrations = try records.map { try $0.asMobileDocumentRegistration() }

            let store = IdentityDocumentProviderRegistrationStore()
            try await Self.removeAllRegistrations(from: store)

            for registration in registrations {
                try await store.addRegistration(registration)
            }
        }

        /// Registers one document, leaving the rest of the store alone.
        AsyncFunction("addDocument") { (record: DocumentRegistrationRecord) in
            guard #available(iOS 26.0, *) else {
                throw UnsupportedIosVersionException()
            }

            let registration = try record.asMobileDocumentRegistration()
            try await IdentityDocumentProviderRegistrationStore().addRegistration(registration)
        }

        AsyncFunction("removeDocument") { (documentIdentifier: String) in
            guard #available(iOS 26.0, *) else {
                throw UnsupportedIosVersionException()
            }

            try await IdentityDocumentProviderRegistrationStore()
                .removeRegistration(forDocumentIdentifier: documentIdentifier)
        }

        AsyncFunction("removeAllCredentials") {
            guard #available(iOS 26.0, *) else {
                throw UnsupportedIosVersionException()
            }

            try await Self.removeAllRegistrations(from: IdentityDocumentProviderRegistrationStore())
        }

        /// The document types this build is entitled to register, from the Info.plist key the
        /// config plugin mirrors the entitlement into. `nil` when the key is absent — a project
        /// that set the entitlement by hand — where the caller falls back to Apple's full set.
        Function("getEntitledDocumentTypes") { () -> [String]? in
            Bundle.main.object(forInfoDictionaryKey: "ANIMO_DC_API_DOCUMENT_TYPES") as? [String]
        }

        /// Path of the app group container, in whichever process asks — so the app and the request
        /// UI can open the same database. Nothing of this package's own lives there.
        Function("getSharedContainerPath") { () -> String in
            guard let containerUrl = DigitalCredentialsAppGroup.containerUrl else {
                throw MissingAppGroupException()
            }

            return containerUrl.path
        }

        /// Release the raw request after the user approved it, as the same JSON array of
        /// `{protocol, data}` Android answers with.
        AsyncFunction("approveRequest") { () -> String in
            let rawRequest = try await Self.session().approve()

            let data = try JSONSerialization.jsonObject(with: rawRequest)
            let requests = [["protocol": "org-iso-mdoc", "data": data]]
            let encoded = try JSONSerialization.data(withJSONObject: requests)

            return String(data: encoded, encoding: .utf8) ?? "[]"
        }

        /// Takes the same JSON encoded `{protocol, data}` object Android answers with, where `data`
        /// is the ISO 18013-7 C.3 `{ "response": <base64url> }` response object.
        ///
        /// Only the `EncryptedResponse` inside it goes to the OS. iOS builds the response object
        /// itself: whatever bytes are handed over here reach the website base64url encoded as the
        /// C.3 `response` member. Passing the object would put a second `{ "response": ... }` around
        /// the first, which the verifier receives as a response it cannot decrypt — the bytes it
        /// base64url decodes are JSON, not the CBOR `EncryptedResponse` it is expecting.
        AsyncFunction("sendResponse") { (credentialResponse: String) in
            guard let encoded = credentialResponse.data(using: .utf8),
                let response = try? JSONSerialization.jsonObject(with: encoded) as? [String: Any],
                let protocolName = response["protocol"] as? String,
                let data = response["data"]
            else {
                throw InvalidCredentialResponseException()
            }

            guard protocolName == "org-iso-mdoc" else {
                throw UnsupportedProtocolException(protocolName)
            }

            guard let encryptedResponse = (data as? [String: Any])?["response"] as? String,
                let responseData = Data(base64UrlEncoded: encryptedResponse)
            else {
                throw InvalidIsoMdocResponseException()
            }

            try Self.session().respond(responseData)
        }

        Function("sendErrorResponse") { (_: String) in
            // Annex C defines no error response, so declining is all the OS offers.
            DcApiRequestSessionStore.current?.cancel()
        }
    }

    /// There is no bulk remove, so the store is emptied one identifier at a time.
    ///
    /// Reading it requires authorization, and the permission prompt is only triggered by the first
    /// `addRegistration` — so before that this throws `.notAuthorized` (error 2). Nothing can be
    /// registered while unauthorized anyway, so an unreadable store is an empty one.
    @available(iOS 26.0, *)
    private static func removeAllRegistrations(from store: IdentityDocumentProviderRegistrationStore) async throws {
        for registration in (try? await store.registrations) ?? [] {
            try await store.removeRegistration(forDocumentIdentifier: registration.documentIdentifier)
        }
    }

    private static func session() throws -> DcApiRequestSession {
        guard let session = DcApiRequestSessionStore.current else { throw NoRequestException() }
        return session
    }
}

@available(iOS 26.0, *)
extension DocumentRegistrationRecord {
    fileprivate func asMobileDocumentRegistration() throws -> MobileDocumentRegistration {
        // Apple takes these as `Data`, and a value that is not base64 would silently drop out of the
        // `compactMap` below — turning a non-empty trust gate into no gate at all if it was the only
        // one.
        for identifier in supportedAuthorityKeyIdentifiers where Data(base64Encoded: identifier) == nil {
            throw InvalidAuthorityKeyIdentifierException(identifier)
        }

        // A date already in the past registers a document the OS can never match, which looks
        // exactly like nothing having been registered — so say so instead.
        if let invalidationDate, invalidationDate <= Date() {
            throw InvalidationDateInThePastException(ISO8601DateFormatter().string(from: invalidationDate))
        }

        return MobileDocumentRegistration(
            mobileDocumentType: documentType,
            // An empty array means no reader-auth requirement, which is what lets unsigned requests
            // surface this wallet in the picker.
            supportedAuthorityKeyIdentifiers: supportedAuthorityKeyIdentifiers.compactMap { Data(base64Encoded: $0) },
            documentIdentifier: documentIdentifier,
            invalidationDate: invalidationDate
        )
    }
}

extension Data {
    /// Base64url without padding, which is how every member of the Annex C payloads is encoded.
    /// `Data(base64Encoded:)` only reads standard base64, and only with padding.
    fileprivate init?(base64UrlEncoded string: String) {
        var base64 = string.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        base64.append(String(repeating: "=", count: (4 - base64.count % 4) % 4))

        self.init(base64Encoded: base64)
    }
}

internal final class UnsupportedIosVersionException: Exception {
    override var reason: String {
        "The Digital Credentials API requires iOS 26 or higher"
    }
}

internal final class NoRequestException: Exception {
    override var reason: String {
        "There is no credential request in flight"
    }
}

internal final class MissingAppGroupException: Exception {
    override var reason: String {
        "No app group is configured. Set `ios.appGroup` in the expo-digital-credentials-api config plugin so the app and the provider extension share a container."
    }
}

internal final class InvalidAuthorityKeyIdentifierException: GenericException<String> {
    override var reason: String {
        "'\(param)' is not a valid base64 encoded authority key identifier"
    }
}

internal final class InvalidationDateInThePastException: GenericException<String> {
    override var reason: String {
        "'ios.invalidationDate' is '\(param)', which has already passed — the registration would never match"
    }
}

internal final class InvalidCredentialResponseException: Exception {
    override var reason: String {
        "The credential response must be a JSON object with a 'protocol' and a 'data' member"
    }
}

internal final class InvalidIsoMdocResponseException: Exception {
    override var reason: String {
        "An 'org-iso-mdoc' response must be an object with a base64url encoded 'response' member, as defined in ISO/IEC TS 18013-7:2025 C.3"
    }
}

internal final class UnsupportedProtocolException: GenericException<String> {
    override var reason: String {
        "iOS can only answer 'org-iso-mdoc' requests, not '\(param)'"
    }
}
