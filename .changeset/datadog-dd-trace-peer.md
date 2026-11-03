---
'@steveojs/datadog': major
---

Breaking changes:

- `dd-trace` is now a peer dependency (`>=5.122.0 <7`) instead of a dependency. Install `dd-trace` in your application; the middleware uses your app's tracer instead of a nested v5 copy, so dd-trace v6 apps no longer need a resolution.
- The publish and consume spans no longer copy the message payload into span tags. Both are tagged with `steveo.topic` only (resource is still the topic). Monitors or queries that relied on payload fields as span tags will stop matching. Publish still adds `_meta.datadog` to object payloads so consume spans stay linked to the publish trace.
- Publish now waits for the rest of the publish chain. Before, the `steveo.publish` span returned before the message was sent, so a send failure became an unhandled rejection instead of rejecting `steveo.publish()`. Send errors now reject `steveo.publish()` with the original error, and the producer's `producer_failure` event fires.
- New `consumeOperationName` option sets the consume span's operation name, e.g. `new DataDogMiddleware({ consumeOperationName: 'my-service.consume' })`. It defaults to `steveo.consume`.

See the package README for installation and usage.
