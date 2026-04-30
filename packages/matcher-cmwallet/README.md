# @animo-id/expo-digital-credentials-api-cmwallet

CMWallet matcher wrapper for verification (OpenID4VP).

## Minimal Usage

Minimal config example:

```ts
const credentials = [
  {
    id: "mdl-1",
    display: {
      title: "mDL",
      subtitle: "Issued by Utopia",
      claims: [
        { path: ["org.iso.18013.5.1", "family_name"], displayName: "Family Name" },
      ],
    },
    credential: {
      format: "mso_mdoc",
      doctype: "org.iso.18013.5.1.mDL",
      namespaces: {
        "org.iso.18013.5.1": {
          family_name: "Glastra",
        },
      },
    },
  },
];
```

```ts
import { registerCredentials } from "@animo-id/expo-digital-credentials-api-cmwallet";

await registerCredentials({ credentials });
// Advanced: pass pre-encoded bytes
// await registerCredentials({ credentialsBytes });
```

## Config Features

`registerCredentials({ credentials })` accepts:

- `credentials`: array of credential entries
Each credential entry supports:

- `id`: matcher-facing credential identifier
- `display.title`: display title
- `display.subtitle`: optional subtitle
- `display.iconDataUrl`: optional data URL (ignored by CMWallet UI)
- `display.claims`: optional display metadata
- `display.claims[].path`: claim path
- `display.claims[].displayName`: optional display label
- `credential.format`: `"mso_mdoc"` or `"dc+sd-jwt"`
- `mso_mdoc.doctype`: document type (when format is `mso_mdoc`)
- `mso_mdoc.namespaces`: namespace → element → value map (when format is `mso_mdoc`)
- `dc+sd-jwt.vct`: credential type (when format is `dc+sd-jwt`)
- `dc+sd-jwt.claims`: decoded claims object (when format is `dc+sd-jwt`)

## Details

- `encodeCredentials` produces matcher registry bytes (binary layout described in `src/schema.ts`) for advanced usage.
- `credentialsBytes`: optional pre-encoded bytes for advanced usage.
- `registerCredentials` accepts raw bytes and loads the bundled matcher WASM.
- The CMWallet matcher ignores icons and claim values for display, even if encoded.

## Types

See `src/schema.ts` and `src/encodeCredentials.ts` for the exact schema and input types.
