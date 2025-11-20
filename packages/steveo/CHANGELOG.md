# steveo

## 9.0.4

### Patch Changes

- b1d0359: Add fifo queue support in getTopicName
- 44e2884: Added Kafka debug logging for consumer group join/leave events

## 9.0.3

### Patch Changes

- cdc8b1c: adding processingMs metric to kafka competion

## 9.0.2

### Patch Changes

- 80b56c0: Add partition tags to Steveo StatsD

## 9.0.1

### Patch Changes

- 2c526f6: Add partition tags to Steveo StatsD producer/runner metrics for better queue visibility

## 9.0.0

### Patch Changes

- e6ec987: Add kafka batching and concurrency support

## 8.4.0

### Minor Changes

- 72ec8c6: Steveo - Add sqs fair queues support

## 8.3.0

### Minor Changes

- b90e293: Poll Interval is reduced after a run that actually picked up tasks

## 8.2.3

### Patch Changes

- fcc2a47: added log line when starting runner

## 8.2.2

### Patch Changes

- bf5de7f: Support FIFO queues when doing health checks in sqs consumers

## 8.2.1

### Patch Changes

- 5f567e1: Improve graceful shutdown for sqs consumers - Steveo

## 8.2.0

### Minor Changes

- 97d030a: Drain resource pools when steveo instances shuts down

## 8.1.1

### Patch Changes

- 0c876b3: Revert default partitioning strategy to non-eager [Kafka]

## 8.1.0

### Minor Changes

- ee711cb: Improve shutting down process - steveo

## 8.0.0

### Major Changes

- 29389d6: Upgrade node-rdkafka, add custom rebalancing

## 7.3.0

### Minor Changes

- c43bb96: Change duration calculation in task runs [Steveo]

## 7.2.0

### Minor Changes

- 19d9a48: Add type guards to publish methods (tasks and root instance)

## 7.1.0

### Minor Changes

- de83802: Hardening workflow execution for first development use
- 51fccf9: Update logging to adhere to bunyan API

### Patch Changes

- 320d043: Remove duplicate log line

## 7.0.3

### Patch Changes

- ae7afe2: There is an issue (more like an easter egg) preventing Kafka message from being
  produced when DatadogMiddleware is activated.

  The issue happens basically because DatadogMiddleware expects payload to be a
  dictionary so it can inject the Datadog traces in the message. However, Kafka is
  sending the `Message.value` attribute, which is a string causing the following error.

  `Cannot create property '_meta' on string '*' `

  The fix consists of changing DatadogMiddleware::publish to not add the datadog
  context attribute to the message whenever `MiddlewareContext.payload` is of type
  string.

- fb35c2c: Fix configuration bug after AWS SQS upgrade.
  The issue occurred due to inconsistencies in local and non-local environments,
  because locally the AWS credentials env variables are required an env vars while
  in non-local we use the instance role, therefore the credentials are not required.

  The fix consists of a new attribute credentials in the config, set during local
  development only, which wrapper the AWS credentials.

## 7.0.2

### Patch Changes

- 4e0e627: Fix bug in `Steveo::task` factory that was registering topics with a wrong name
  as a result of a bug in the `formatTopicName`. This was causing SQS queue not
  being created correctly and failures in the healthcheck.

## 7.0.0

### Major Changes

- f1392ba: Upgrade AWS SDK major version to 3.\*

  Even though, there was no breaking change in Steveo the AWS SDK upgrade some core features that may cause unexpected
  behavior in Steveo. So for, unit tests and manual tests haven't identified any inconsistency but that does not mean it
  cannot still happen.

  There were no changes in how Steveo should be used.

### Minor Changes

- d4b0840: Added workflow pipeline definitions and execution engine

## 6.7.0

### Minor Changes

- 3a11696: Ensure manger waits for runners and producers to shutdown

## 6.6.0

### Minor Changes

- c09d72e: Increase the default termination wait count to give the process longer to complete

## 6.5.0

### Minor Changes

- 223f9f2: Added back `value` property for backwards compatibility

## 6.4.0

### Minor Changes

- b307437: Added SQS dead letter queue support
- b8ce814: Re-align kafka consumer callback payload parsing
- 4fcf0da: Added support to FIFO queue on task level
- b77b951: Set FIFO on SQS createQueue

### Patch Changes

- 1ff81d7: Fix bug that was causing Job data and Job context to be merged instead of
  passed separately to the task.publish method.

  Schedules:

  - Update taskRunner method to not merge the data together

  Steveo:

  - Adjust producers to receive `data` and `context` separately and add context as a `_meta` attribute at message creation
    time, before publishing a task payload to the queue.
  - Adjust consumers to extract `data` the `_meta` attribute from the message, to be passed to the Task callback
    separate input variables.

## 6.3.0

### Minor Changes

- 2ed3a1e: Bump dependencies

### Patch Changes

- 7ab3a45: Fix SQS consumer issue preventing message context from being unpacked.
  The code responsible for unpacking the context was accidentally removed during Steveo migration from v5 to v6.

## 6.2.0

### Minor Changes

- 4703bdf: Added option to add a partition key for a topic

### Patch Changes

- dfb642a: Adds a check to see if the kafka producer is connected before disconnecting. This prevents an error being thrown for an unconnected producer getting a disconnect call.

## 6.1.1

### Patch Changes

- Fix build step

## 6.1.0

### Minor Changes

- 28932c6: Change health check parameters - Kafka consumers

## 6.0.1

### Patch Changes

- 6a3ad40: Adding a version commit
- be1cee2: Add integration test for steveo kafka backend

## 6.0.0

### Patch Changes

- Testing publishing
