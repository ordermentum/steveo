---
"steveo": patch
---

Fix bug in `Steveo::task` factory that was registering topics with a wrong name
as a result of a bug in the `formatTopicName`. This was causing SQS queue not
being created correctly and failures in the healthcheck.
