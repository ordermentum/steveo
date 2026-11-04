---
'@steveojs/datadog': major
---

- `dd-trace` is now a peer dependency (`>=5.122.0 <7`); install it in your application.
- Publish and consume spans are tagged with `steveo.topic` only; message payloads are no longer copied into span tags.
- New `consumeOperationName` option sets the consume span name (default `steveo.consume`).
