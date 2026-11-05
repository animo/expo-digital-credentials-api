import Foundation

/// The origin URL the OS reports, serialized as the verifier does (`scheme://host[:port]`): the
/// trailing slash of `absoluteString` would change the C.5 session transcript and break decryption.
func webOrigin(_ originURL: URL) -> String {
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
