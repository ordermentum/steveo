# steveo

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
