// Reexport the native module. On web, it will be resolved to DigitalCredentialsApiModule.web.ts
// and on native platforms to DigitalCredentialsApiModule.ts
export { default } from './DigitalCredentialsApiModule';
export { default as DigitalCredentialsApiView } from './DigitalCredentialsApiView';
export * from  './DigitalCredentialsApi.types';
