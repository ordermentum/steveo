---
"steveo": minor
---

Stop Kafka consumers redelivering messages after a batch or a rebalance

A batch is drained from the consumer queue, so it can span partitions and topics, but only the last message in it was committed. Every partition a batch drew from is now committed at its highest processed offset.

Partition assignment is now handled by the client rather than a callback in steveo. Cooperative rebalancing works properly (the callback did a full assign/unassign, dropping partitions the member still owned), and a failed rebalance no longer shuts the consumer down. Before revoked partitions are released, steveo commits the offsets it has processed — librdkafka only flushes on revoke when `enable.auto.commit` is on, which steveo turns off.

Anything passing its own `rebalance_cb` through `consumer.global` still overrides the client's handling; the offset flush runs either way.
