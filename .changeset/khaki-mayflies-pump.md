---
"@steveojs/datadog": patch
---

Change DatadogMiddleware::publish to verify whether `MiddlewareContext.payload`
is a string, and if so, do not attempt to add the datadog trace_id to the message
context.
