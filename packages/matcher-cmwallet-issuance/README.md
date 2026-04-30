# @animo-id/expo-digital-credentials-api-cmwallet-issuance

CMWallet issuance matcher wrapper for OpenID4VCI creation options.

## Minimal Usage

```ts
import {
  encodeIssuanceCreationOptions,
  registerCreationOptions,
} from "@animo-id/expo-digital-credentials-api-cmwallet-issuance";

const creationOptions = encodeIssuanceCreationOptions({
  display: {
    title: "My Wallet",
    subtitle: "Save your document",
    iconDataUrl: "data:image/png;base64,...",
  },
  issuerAllowlist: ["https://issuer.example"],
});

await registerCreationOptions({ creationOptions });
```

## Config Features

`encodeIssuanceCreationOptions({ display, issuerAllowlist })` accepts:

- `display.title`: display title
- `display.subtitle`: optional subtitle
- `display.iconDataUrl`: optional data URL for the entry icon
- `issuerAllowlist`: optional list of issuer URLs to allow for issuance

## Details

- `encodeIssuanceCreationOptions` produces creation options bytes (binary layout described in `src/schema.ts`).
- `registerCreationOptions` accepts raw bytes and loads the bundled matcher WASM.

## Types

See `src/schema.ts` and `src/encodeIssuance.ts` for the exact schema and input types.
