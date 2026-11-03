# steveo-trace-provider-datadog

A Datadog trace provider for the
[steveo](https://github.com/ordermentum/steveo) pub/pub background processing
library.

## Installation

`dd-trace` is a peer dependency (`>=5.122.0 <7`), so install it alongside this
package. The middleware uses your application's tracer.

```sh
yarn add @steveojs/datadog dd-trace
```

## Usage

```ts
import { Steveo } from 'steveo';
import DataDogMiddleware from '@steveojs/datadog';

const steveo = new Steveo({
  ...config,
  middleware: [
    new DataDogMiddleware({ consumeOperationName: 'my-service.consume' }),
  ],
});
```

Each consumed message runs inside a span named `consumeOperationName`
(default `steveo.consume`), with the topic as the resource and the
`steveo.topic` tag. The message payload is not added to span tags.
