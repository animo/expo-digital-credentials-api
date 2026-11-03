# Multipaz matcher

The Credman matcher bundled as `android/src/main/assets/multipaz-matcher.wasm`. It is a copy of
[multipaz](https://github.com/openwallet-foundation/multipaz/tree/8b1ef774d65f2296084bae8edb8e1ba1086e6e11/multipaz-dcapi-credman/src/androidMain/matcher)
at `8b1ef774` (Apache-2.0), without the issuance matcher.

Changes from upstream, meant to go back upstream once verified:

- OpenID4VP `transaction_data` is read and recorded on the DCQL credential queries its `credential_ids` name. A request with an entry that cannot be read, or that names no query, matches nothing.
- A query carrying transaction data only matches credentials registered with `transactionDataTypes` that list all its types. A credential registered with `transactionDataOnly` only matches such queries.
- An SD-JWT VC registered with `extendedVcts` also matches queries for the vcts its type extends.
- A payment of type `urn:paso:sca:global:payment:1` or `urn:eudi:sca:eu.europa.ec:payment:single:1` is shown with `AddPaymentEntryToSet`, or `AddPaymentEntry` on runtime version 1. An amount in `EUR` is shown with `€`.

## Building

Install [WASI SDK 20](https://github.com/WebAssembly/wasi-sdk/releases/tag/wasi-sdk-20) in `~/wasi-sdk-20.0`, or point `WASI_SDK` at it, then run `make` here. It builds `build/matcher.wasm` and copies it into the Android assets. Run `pnpm test` from the package root afterwards: `src/__tests__/multipazMatcher.test.ts` runs the bundled wasm.

The [cJSON library](https://github.com/DaveGamble/cJSON) is bundled as `cJSON.[c, h]` with its
license in `cJSON-LICENSE`. The [LibCppBor library](https://android.googlesource.com/platform/system/libcppbor/)
is bundled as `cppbor.[cpp, h]` and `cppbor_parse.[cpp, h]` (Apache-2.0).
