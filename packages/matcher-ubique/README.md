# @animo-id/expo-digital-credentials-api-ubique

Ubique matcher wrapper for verification (OpenID4VP).

## Minimal Usage

Minimal config example:

```ts
const credentials = [
  {
    id: "pid-1",
    display: {
      title: "PID",
      subtitle: "Issued by Utopia",
      iconDataUrl: "data:image/png;base64,...",
      claims: [
        { path: ["family_name"], displayName: "Family Name" },
      ],
    },
    credential: {
      format: "dc+sd-jwt",
      vct: "eu.europa.ec.eudi.pid.1",
      claims: {
        family_name: "Glastra",
      },
    },
  },
];
```

```ts
import { registerCredentials } from "@animo-id/expo-digital-credentials-api-ubique";

await registerCredentials({ credentials, debug: true });
// Advanced: pass pre-encoded bytes
// await registerCredentials({ credentialsBytes });
```

## Config Features

`registerCredentials({ credentials, debug })` accepts:

- `credentials`: array of credential entries
- `debug`: optional boolean, included in registry JSON (Ubique uses it)
- `credentialsBytes`: optional pre-encoded bytes for advanced usage

Each credential entry supports:

- `id`: matcher-facing credential identifier
- `display.title`: display title
- `display.subtitle`: optional subtitle
- `display.iconDataUrl`: optional data URL (Ubique supports icons)
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
- `registerCredentials` accepts raw bytes and loads the bundled matcher WASM.
- Ubique supports icons and claim value display.

## Types

See `src/schema.ts` and `src/encodeCredentials.ts` for the exact schema and input types.
