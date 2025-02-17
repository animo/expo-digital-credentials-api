<p align="center">
  <picture>
   <source media="(prefers-color-scheme: light)" srcset="https://res.cloudinary.com/animo-solutions/image/upload/v1656578320/animo-logo-light-no-text_ok9auy.svg">
   <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/animo-solutions/image/upload/v1656578320/animo-logo-dark-no-text_fqqdq9.svg">
   <img alt="Animo Logo" height="200px" />
  </picture>
</p>

<h1 align="center" ><b>Expo - Digital Credentials API</b></h1>

<h4 align="center">Powered by &nbsp; 
  <picture>
    <source media="(prefers-color-scheme: light)" srcset="https://res.cloudinary.com/animo-solutions/image/upload/v1656579715/animo-logo-light-text_cma2yo.svg">
    <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/animo-solutions/image/upload/v1656579715/animo-logo-dark-text_uccvqa.svg">
    <img alt="Animo Logo" height="12px" />
  </picture>
</h4><br>

<p align="center">
  <a href="https://typescriptlang.org">
    <img src="https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg" />
  </a>
  <a href="https://www.npmjs.com/package/@animo-id/expo-digital-credentials-api">
    <img src="https://img.shields.io/npm/v/@animo-id/expo-digital-credentials-api" />
  </a>
  <a
    href="https://raw.githubusercontent.com/animo/expo-digital-credentials-api/main/LICENSE"
    ><img
      alt="License"
      src="https://img.shields.io/badge/License-EUPL%201.2-blue.svg"
  /></a>
</p>

<p align="center">
  <a href="#getting-started">Getting started</a> 
  &nbsp;|&nbsp;
  <a href="#contributing">Contributing</a> 
  &nbsp;|&nbsp;
  <a href="#contributing">License</a> 
</p>

---

An [Expo Module](https://docs.expo.dev/modules/overview/) and [Expo Config Plugin](https://docs.expo.dev/guides/config-plugins/) to automatically set up and configure [Digital Credentials API](https://digitalcredentials.dev) for Android in Expo apps.

- Currently a default matcher implementation for matching credentials based on a request is bundled, which only supports _mdoc_, _openid4vp_ , _dcql_ and _unsigned requests_. In the future support for custom matcher might be added.
- During development when the activity is launched and the application is already running this results in render errors. In production these errors won't occur, but it does hinder the development experience. We're still looking for a solution.
- This library is tested with Expo 52 and React Native 0.76. It uses some hacks to use Kotlin 2.0.21, and is likely to break in non-default application setups. React Native 77 will use Kotlin 2 by default, and these hacks shouldn't be needed anymore.

> [!NOTE]  
> This library integrates with experiments Android APIs, as well as draft versions of several specifications. Expect all APIs to break in future releases.

## Getting Started

Install the plugin and `expo-build-properties` using the following command. We need `expo-build-properties` to set the `kotlinVersion` for Android to `2.0.21`.

```sh
# yarn
yarn add @animo-id/expo-digital-credentials-api expo-build-properties

# npm
npm install @animo-id/expo-digital-credentials-api expo-build-properties

# npm
pnpm install @animo-id/expo-digital-credentials-api expo-build-properties
```

Then add the plugin to your Expo app config (`app.json`, `app.config.json` or `app.config.js`) `plugins` array:

```json
{
  "expo": {
    "plugins": [
      "@animo-id/expo-digital-credentials-api",
      [
        "expo-build-properties",
        {
          "android": {
            "kotlinVersion": "2.0.21"
          }
        }
      ]
    ]
  }
}
```

> [!NOTE]
> The `expo` top level key is only needed in `app.json`. In `app.config.json`, `app.config.js` and `app.config.ts` the top level expo key is not present anymore.

And lastly, prebuild the application so the Expo Module wrapper can be added as native dependency (If you aren't making any manual modification to the Android directories you can add them to the gitignore of your project and generate them on demand):

```sh
# yarn
yarn expo prebuild

# npm
npx expo prebuild
```

That's it, you now have the Digital Credentials API configured for your Android project.

## Usage

You can now import `@animo-id/expo-digital-credentials-api` in your application.

### Registering Credentials

To make Android aware of the credentials availble in your wallet, you need to register the credentials. Every time the credentials in your application changes, you should call this method again.

```tsx
import {
  registerCredentials,
  RegisterCredentialsOptions,
} from "@animo-id/expo-digital-credentials-api";

// See RegisterCredentialsOptions for all options
await registerCredentials({
  credentials: [
    {
      id: "1",
      display: {
        title: "Drivers License",
      },
      credential: {
        doctype: "org.iso.18013.5.1.mDL",
        format: "mso_mdoc",
        namespaces: {
          "org.iso.18013.5.1": {
            family_name: "Glastra",
          },
        },
      },
    },
  ],
} satisfies RegisterCredentialsOptions);
```

### Handling Credential Request

When the user has selected a credential from your application, the application will be launched with an intent to retrieve the credentials. The application will be launched as a separate instance.

> [!NOTE]  
> Currently the main activity will be launched as a full screen application. In the future we might allow registering a custom component and activity to handle incoming requests. This will enable to render a modal over the requesting application (e.g. the browser window) to quickly allow the user to approve a request.

To handle a credential request the following steps are involved:

- `getRequest` and `onRequestListener`/`useRequestListener` - This enables you to get the request that requests a credential from your application.
- `sendResponse` and `sendErrorResponse` - This enables you to send a response to the incoming request. You should only call this if you received a request as it will finish and close the activity.

#### Retrieving the request

Depending on whether the application is already active there's two ways to get the incoming request. Generally you should handle both methods:

- Call `getRequest` on application launch to handle a credential request that launched your application.
- Add a request listener with `onRequestListener`/`useRequestListener` to handle any credential requests after the application was launched.

```tsx
import {
  getRequest,
  useRequestListener,
} from "@animo-id/expo-digital-credentials-api";
import { useState, useEffect } from "react";

export default function App() {
  const [staticRequest, setRequest] = useState(getRequest());
  const eventRequest = useRequestListener();
  const request = eventRequest ?? staticRequest;

  const acceptResponse = () => {
    // this logic is dependant on your app
    const response = prepareResponse(request);

    sendResponse({
      response: JSON.strigify(response),
    });
  };

  const declineResponse = () => {
    sendErrorResponse({ errorMessage: "The user declined the request" });
  };

  // if there is a request you can render any content you want
  // that lets the user approve the incoming request
  if (request) {
    // You can render buttons to accept / decline the request here, as well
    // as information about the request
    return null;
  }

  return null;
}
```

## Contributing

Is there something you'd like to fix or add? Great, we love community contributions! To get involved, please follow our [contribution guidelines](./CONTRIBUTING.md).

## License

Expo Digital Credentials Api is licensed under the [Apache 2.0](./LICENSE) license.
