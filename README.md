<h1 align="center">Welcome to steveo 👋</h1>
<p>
  <a href="https://www.npmjs.com/package/steveo" target="_blank">
    <img alt="Version" src="https://img.shields.io/npm/v/steveo.svg">
  </a>
  <a href="#" target="_blank">
    <img alt="License: Apache--2.0" src="https://img.shields.io/badge/License-Apache--2.0-yellow.svg" />
  </a>
</p>

[![npm version](https://badge.fury.io/js/steveo.svg)](https://badge.fury.io/js/steveo)
[![CI](https://github.com/ordermentum/steveo/actions/workflows/main.yml/badge.svg?branch=develop)](https://github.com/ordermentum/steveo/actions/workflows/main.yml)
[![npm](https://img.shields.io/npm/l/steveo.svg)](https://www.npmjs.com/package/steveo)
[![npm](https://img.shields.io/npm/dt/steveo.svg)](https://www.npmjs.com/package/steveo)

A Task Pub/Sub Background processing library (Task Framework for Node.js)

Steveo is a task management library that supports Kafka, SQS and Redis.

Think of it as [sidekiq](https://github.com/mperham/sidekiq) for node.js with support for multiple backends.

On a highlevel, it works as below, Steveo has 3 main components

```
              +-----------+     +-----------+     +-----------+
              |           |     |           |     |           |
PUBLISH ----->|   TASK    |     | REGISTRY  |     |   RUNNER  |-----> RECEIVE
              |           |     |           |     |           |
              |           |     |           |     |           |
              +-----------+     +-----------+     +-----------+
```

## Installation

This is a Node.js module available through the npm registry.

Before installing, download and install Node.js. Node.js 12 or higher is required.

If this is a brand new project, make sure to create a package.json first with the npm init command.

Installation is done using the npm install command:

$ npm install steveo


## Author

👤 **engineering@ordermentum.com**

### Task

Holds the information about the type of task. It has below methods,

- publish - send a message onto a queue
- subscribe - process a message

### Registry

Responsible for keeping the inventory of tasks & event manager. Whenever a new task is created, an entry will be added in the registry

### Runner

Responsible for consuming messages,

- `process` method initialize group consumers and start to consume the messages. It will then call the subscribe callback set on the task

Emitting events based on success/failures

- runner_receive -> Received a message
- runner_complete -> Completed running the associated task
- runner_failure -> Failed running the associated task
- runner_connection_failure -> Error while polling for message (Kafka only)

- task_send
- task_success
- task_failure
- task_added
- task_removed

- producer_success
- producer_failure

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

Publish without registering a task

```javascript
await steveo.publish('example-task', { name: 'Apple' });
```

For more details, see [example](https://github.com/ordermentum/steveo/blob/master/examples/full/README.md)


## Contributing


### Installing dependencies

```sh
yarn install
```

## Running tests

```sh
yarn run test
```


_Credits_

- [nokafka](https://github.com/oleksiyk/kafka)
- [rsmq](https://github.com/smrchy/rsmq)
- [aws-sdk](https://github.com/aws/aws-sdk-js)
