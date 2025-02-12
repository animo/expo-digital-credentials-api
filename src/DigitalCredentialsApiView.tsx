import { requireNativeView } from 'expo';
import * as React from 'react';

import { DigitalCredentialsApiViewProps } from './DigitalCredentialsApi.types';

const NativeView: React.ComponentType<DigitalCredentialsApiViewProps> =
  requireNativeView('DigitalCredentialsApi');

export default function DigitalCredentialsApiView(props: DigitalCredentialsApiViewProps) {
  return <NativeView {...props} />;
}
