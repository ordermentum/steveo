---
"steveo": patch
---

There is an issue (more like an easter egg) preventing Kafka message from being
produced when DatadogMiddleware is activated.

The issue happens basically because DatadogMiddleware expects payload to be a
dictionary so it can inject the Datadog traces in the message. However, Kafka is
sending the `Message.value` attribute, which is a string causing the following error.

`Cannot create property '_meta' on string '*' `

The fix consists of making sure both Kafka producers and Kafka consumers sends
the message payload as a dictionary to any registered middleware.
