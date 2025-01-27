# @steveojs/datadog

## 9.0.0

### Patch Changes

- Updated dependencies [19d9a48]
  - steveo@7.2.0

## 8.0.0

### Patch Changes

- Updated dependencies [de83802]
- Updated dependencies [51fccf9]
- Updated dependencies [320d043]
  - steveo@7.1.0

## 7.1.3

### Patch Changes

- 95e727f: Fix DatadogMiddleware::getDatadogContextData receiving incorrect argument

## 7.1.2

### Patch Changes

- ae7afe2: Change DatadogMiddleware::publish to verify whether `MiddlewareContext.payload`
  is a string, and if so, do not attempt to add the datadog trace_id to the message
  context.
- Updated dependencies [ae7afe2]
- Updated dependencies [fb35c2c]
  - steveo@7.0.3

## 7.1.1

### Patch Changes

- 161ceb1: Fix datadog lib folder structure, introduced by latest minor upgrade.
  In the 7.1.0 version, the tests folder was added to the includes list, in the
  tsconfig.json which caused the compile `lib` folder to contains new src and test
  folders instead of containing only the index.js entrypoint file.

## 7.1.0

### Minor Changes

- b9023d7: Updates DatadogMiddleware propagate the DD traces down the message life cycle.

  1. During the message publishing the extracts the trace_id and parent_id from the current context and injects it to the message \_meta attributes, under the datadog key.

  2. During the message processing, if the message \_meta attributes contains a datadog key, then its content is extracted and associated with the current context as a parent.

## 7.0.0

### Minor Changes

- f1392ba: Upgrade AWS SDK major version to 3.\*

  Even though, there was no breaking change in Steveo the AWS SDK upgrade some core features that may cause unexpected
  behavior in Steveo. So for, unit tests and manual tests haven't identified any inconsistency but that does not mean it
  cannot still happen.

  There were no changes in how Steveo should be used.

### Patch Changes

- Updated dependencies [f1392ba]
- Updated dependencies [d4b0840]
  - steveo@7.0.0

## 6.0.0

### Patch Changes

- Updated dependencies [3a11696]
  - steveo@6.7.0

## 5.0.0

### Patch Changes

- Updated dependencies [c09d72e]
  - steveo@6.6.0

## 4.0.0

### Patch Changes

- Updated dependencies [223f9f2]
  - steveo@6.5.0

## 3.0.0

### Patch Changes

- Updated dependencies [1ff81d7]
- Updated dependencies [b307437]
- Updated dependencies [b8ce814]
- Updated dependencies [4fcf0da]
- Updated dependencies [b77b951]
  - steveo@6.4.0

## 2.0.0

### Minor Changes

- 2ed3a1e: Bump dependencies

### Patch Changes

- Updated dependencies [2ed3a1e]
- Updated dependencies [7ab3a45]
  - steveo@6.3.0

## 1.0.0

### Patch Changes

- Updated dependencies [dfb642a]
- Updated dependencies [4703bdf]
  - steveo@6.2.0

## 0.0.2

### Patch Changes

- 48cc840: Initial version of the datadog middleware. It will create a steveo.publish and steveo.consume span
