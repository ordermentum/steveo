---
"steveo": minor
---

Support QUEUE_PREFIX and CONSUMER_GROUP_PREFIX environment variables

- `QUEUE_PREFIX` overrides `queuePrefix` config, controlling SQS queue and Kafka topic name prefixes at the deployment level without code changes.
- `CONSUMER_GROUP_PREFIX` prepends a prefix to the Kafka consumer `group.id`, enabling consumer group isolation between environments (e.g. SIT vs sandbox).

These enable environment isolation by setting two env vars, without requiring code changes in each service.
