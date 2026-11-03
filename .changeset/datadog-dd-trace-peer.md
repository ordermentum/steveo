---
'@steveojs/datadog': major
---

Breaking changes:

- `dd-trace` is now a peer dependency (`>=5.122.0 <7`) instead of a dependency. Install `dd-trace` in your application; the middleware uses your app's tracer instead of a nested v5 copy, so dd-trace v6 apps no longer need a resolution.
- The consume span no longer copies the message payload into span tags. It is tagged with `steveo.topic` only (resource is still the topic). Monitors or queries that relied on payload fields as span tags will stop matching.
- New `consumeOperationName` option sets the consume span's operation name, e.g. `new DataDogMiddleware({ consumeOperationName: 'my-service.consume' })`. It defaults to `steveo.consume`.
