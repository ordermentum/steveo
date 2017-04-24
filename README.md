# Steveo - Kafka Task Framework for Node.js

[![npm version](https://badge.fury.io/js/steveo.svg)](https://badge.fury.io/js/steveo)
[![Build Status](https://travis-ci.org/ordermentum/steveo.svg?branch=master)](https://travis-ci.org/ordermentum/steveo)
[![dependencies Status](https://david-dm.org/ordermentum/steveo/status.svg)](https://david-dm.org/ordermentum/steveo)
[![devDependencies Status](https://david-dm.org/ordermentum/steveo/dev-status.svg)](https://david-dm.org/ordermentum/steveo?type=dev)
[![npm](https://img.shields.io/npm/l/steveo.svg)](https://www.npmjs.com/package/steveo)
[![npm](https://img.shields.io/npm/dt/steveo.svg)](https://www.npmjs.com/package/steveo)


Steveo is a task management library for Kafka

On a highlevel, it works as below, Steveo has 3 main factory components

              +-----------+                  +-----------+
              |           |                  |           |
              |   TASK    |                  | REGISTRY  |
              |           |                  |           |
              |           |                  |           |
              +-----------+                  +-----------+

                              +-----------+
                              |           |
                              |   RUNNER  |
                  SEND  <-----|           |<----- RECEIVE
                              |           |
                              +-----------+

### Task

Holds the information about the type of task. It has below methods,
  - publish
  - subscribe
  - events

### Registry

Responsible for keeping the inventory of tasks. Whenever a new task is created, an entry will be added in the registry

### Runner

Responsible for consuming messages,
 - `process` method initialize group consumers and start to consume the messages. It will then call the subscribe callback set on the task

### Example

```javascript
(async () => {
  const steveo = new Steveo({
    kafkaConnection: process.env.KAFKA_CONNECTION,
    clientId: '1234-123',
  });

  const example = steveo.task('example-task', (hello) => {
  console.log(`hello ${hello}`);
  });

  await example.publish('tommo');
  await example.publish('bazza');

  await steveo.runner().process();
})();
```

For more details, see [example](https://github.com/ordermentum/steveo/blob/master/example/README.md)
