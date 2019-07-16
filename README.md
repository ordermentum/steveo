# Steveo - Task Framework for Node.js

[![npm version](https://badge.fury.io/js/steveo.svg)](https://badge.fury.io/js/steveo)
[![Build Status](https://travis-ci.org/ordermentum/steveo.svg?branch=master)](https://travis-ci.org/ordermentum/steveo)
[![npm](https://img.shields.io/npm/l/steveo.svg)](https://www.npmjs.com/package/steveo)
[![npm](https://img.shields.io/npm/dt/steveo.svg)](https://www.npmjs.com/package/steveo)


Steveo is a task management library that supports Kafka, SQS and Redis.

On a highlevel, it works as below, Steveo has 3 main components
```
              +-----------+     +-----------+     +-----------+
              |           |     |           |     |           |
PUBLISH ----->|   TASK    |     | REGISTRY  |     |   RUNNER  |-----> RECEIVE
              |           |     |           |     |           |
              |           |     |           |     |           |
              +-----------+     +-----------+     +-----------+
```

### Task

Holds the information about the type of task. It has below methods,
  - publish
  - subscribe function

### Registry

Responsible for keeping the inventory of tasks & event manager. Whenever a new task is created, an entry will be added in the registry

### Runner

Responsible for consuming messages,
 - `process` method initialize group consumers and start to consume the messages. It will then call the subscribe callback set on the task

### Example

```javascript
(async () => {
  const steveo = Steveo({
    kafkaConnection: process.env.KAFKA_CONNECTION,
    clientId: '1234-123',
  });

  const example = steveo.task('example-task', async ({ name }) => {
    console.log(`hello ${name}`);
  });

  await example.publish({ name: 'tommo' });
  await example.publish({ name: 'bazza' });

  await steveo.runner().process();
})();
```

For more details, see [example](https://github.com/ordermentum/steveo/blob/master/example/README.md)

_Credits_

- [nokafka](https://github.com/oleksiyk/kafka)
- [rsmq](https://github.com/smrchy/rsmq)
- [aws-sdk](https://github.com/aws/aws-sdk-js)

