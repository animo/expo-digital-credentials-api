# @animo-id/expo-digital-credentials-api-aptitude-consortium

Expo wrapper for the Aptitude Consortium DC API matcher. The package bundles the matcher WASM and registers credentials for OpenID4VP.

## Usage

```ts
import { registerCredentials } from "@animo-id/expo-digital-credentials-api-aptitude-consortium";

await registerCredentials({
  aptitudeConsortiumConfig: {
    credentials: [
      {
        id: "pid-1",
        format: "dc+sd-jwt",
        title: "PID",
        vcts: ["urn:eudi:pid:1"],
        claims: { age_over_18: true },
        fields: [{ path: ["age_over_18"], display_name: "Age over 18" }],
      },
    ],
  },
});
```

You can also pass pre-encoded config through `credentialsBytes`, or override the bundled WASM through `matcherBytes`.

## Defaults

`registerCredentials` fills omitted config with supported OpenID4VP defaults:

```ts
openid4vp: {
  enabled: true,
  supported_request_protocols: [
    "openid4vp-v1-unsigned",
    "openid4vp-v1-signed",
    "openid4vp-v1-multisigned",
  ],
  supported_response_modes: ["dc_api", "dc_api.jwt"],
  supported_response_types: ["vp_token"],
  supported_query_methods: ["dcql_query"],
  supported_request_parameters: ["transaction_data"],
}
```

Omit a list to keep the default. Pass an empty list to disable that feature. Unsupported request parts produce no match for that branch. Unknown or malformed request/config parts are ignored where possible.

## Config

```ts
import type { AptitudeConsortiumConfig } from "@animo-id/expo-digital-credentials-api-aptitude-consortium";

const config: AptitudeConsortiumConfig = {
  log_level: "warn",
  dcql: {
    credential_set_option_mode: "all_satisfiable",
    optional_credential_sets_mode: "prefer_present",
  },
  payment_sca: {
    "urn:eudi:sca:eu.europa.ec:payment:single:1": {
      payee: ["payload", "payee", "name"],
      amount: ["payload", "amount"],
      additional_info: ["payload", "reference"],
    },
  },
  credentials: [
    {
      id: "sca-1",
      format: "dc+sd-jwt",
      title: "Payment credential",
      vcts: ["urn:eudi:payment:1"],
      holder_binding: true,
      claims: { subject: "holder" },
      fields: [{ path: ["subject"], display_name: "Subject" }],
      transaction_data_types: {
        "urn:eudi:sca:eu.europa.ec:payment:single:1": {
          claims: [
            { path: ["transaction_id"], mandatory: true },
            {
              path: ["amount"],
              mandatory: true,
              value_type: "iso_currency_amount",
              display: [{ locale: "en", name: "Amount" }],
            },
            {
              path: ["payee", "name"],
              mandatory: true,
              display: [{ locale: "en", name: "Payee" }],
            },
          ],
        },
      },
    },
    {
      id: "mdl-1",
      format: "mso_mdoc",
      title: "Mobile Driving Licence",
      doctype: "org.iso.18013.5.1.mDL",
      claims: {
        "org.iso.18013.5.1": { family_name: "Doe" },
      },
      fields: [
        {
          path: ["org.iso.18013.5.1", "family_name"],
          display_name: "Family Name",
        },
      ],
    },
  ],
};
```

Top level:

- `default_id_prefix`: prefix for generated credential ids.
- `openid4vp`: support gates for protocols, response modes/types, query methods, and request parameters.
- `dcql`: `credential_set_option_mode` and `optional_credential_sets_mode`.
- `payment_sca`: map transaction data type URNs to Credman payment UI fields.
- `log_level`: `error`, `warn`, `info`, `debug`, or `trace`.
- `credentials`: registered credential entries.

Credential:

- `format`: `dc+sd-jwt`, `mso_mdoc`, or another matcher-supported format string.
- `vcts`: accepted VCTs for SD-JWT.
- `doctype`: mDOC document type.
- `holder_binding`: defaults to `true`.
- `claims`: decoded claim values used for DCQL matching.
- `fields`: labels/values shown for selected credential claims.
- `metadata`: optional credential metadata; standard claim display names may be read from `metadata.claims`.
- `icon`: base64 string without data URL prefix, or `number[]`.
- `transaction_data_types`: transaction data metadata supported by this credential.

Transaction data:

- `transaction_data_types` can be an object keyed by type URN or an array with `{ type, claims }`.
- `claims[].path` is relative to `transaction_data.payload`.
- `claims[].mandatory` requires the payload claim.
- `claims[].value_type` validates displayable values (`iso_currency_amount`, `boolean`, `url`, etc.).
- Non-empty `claims[].display` marks a claim displayable for validation. It is accepted for compatibility and is not rendered as Credential Manager fields.

Payment/SCA:

- `payment_sca` paths are relative to the full transaction data object, so payload fields usually start with `["payload", ...]`.
- `amount` should point to the full display string, for example `"42.50 EUR"`.
- Only mapped transaction data is shown in payment UI and marked `displayed: true`.
- Transaction data can still be associated and consented without being displayed as payment UI.

## Selection

Use `getAptitudeSelection(request)` to read matcher metadata:

```ts
import { getAptitudeSelection } from "@animo-id/expo-digital-credentials-api-aptitude-consortium";
import type { DigitalCredentialsRequest } from "@animo-id/expo-digital-credentials-api";

function handleRequest(request: DigitalCredentialsRequest) {
  const selection = getAptitudeSelection(request);
  for (const slot of selection?.slots ?? []) {
    console.log(slot.dcql_id, slot.credential_id, slot.transaction_data);
  }
}
```

Each slot contains one selected credential or the `__none__` sentinel:

```ts
type AptitudeSelectionSlot = {
  dcql_id: string
  entryId: string
  credential_id: string
  transaction_data?: {
    index: number
    displayed: boolean
  }
}
```

`transaction_data.index` points to the request `transaction_data` array. `displayed` is `true` only when the matcher showed that transaction data through dedicated UI, currently `payment_sca`.

Helpers:

- `loadMatcherBytes()`
- `encodeAptitudeConsortiumConfig(config)`
- `withDefaultAptitudeConsortiumConfig(config)`
- `DEFAULT_APTITUDE_CONSORTIUM_CONFIG`
- `DEFAULT_APTITUDE_CONSORTIUM_OPENID4VP_CONFIG`
