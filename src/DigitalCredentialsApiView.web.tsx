import * as React from 'react';

import { DigitalCredentialsApiViewProps } from './DigitalCredentialsApi.types';

export default function DigitalCredentialsApiView(props: DigitalCredentialsApiViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
