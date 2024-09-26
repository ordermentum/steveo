---
"@steveojs/datadog": minor
---

Updates DatadogMiddleware propagate the DD traces down the message life cycle.

1. During the message publishing the extracts the trace_id and parent_id from the current context and injects it to the message _meta attributes, under the datadog key.

2. During the message processing, if the message _meta attributes contains a datadog key, then its content is extracted and associated with the current context as a parent.
