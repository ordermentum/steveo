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

A Full Featured Job/Task Pub/Sub Background processing framework (Task Framework for Node.js)

Steveo is a task management library that supports Kafka, SQS and Redis.

Australian's have a habit of abbreviating names like "John" to "Johno" or "Michael" to "Micko," or elongating names with extra vowels like "Sarah" becoming "Sazza". In this case, Steve becomes Steveo and is a play on Steve Jobs -> Background Jobs -> Async Task Processing.

Steveo is primarily used for asynchronous task processing. You can define tasks that perform time-consuming operations without blocking the main execution in a http request.

With support for multiple backend systems like Kafka and SQS, Steveo enables scalable task processing. You can distribute tasks across multiple consumers and achieve high throughput scaling.

Think of it as [sidekiq](https://github.com/mperham/sidekiq) for node.js with support for multiple backends.

## Installation

This is a Node.js module available through the npm registry.

Before installing, download and install Node.js. Node.js 12 or higher is required.

If this is a brand new project, make sure to create a package.json first with the npm init command.

Installation is done using the npm install command:

```bash
$ npm install steveo
```

## Author

👤 **engineering@ordermentum.com**


### Example

```javascript
(async () => {
  const steveo = Steveo();

  const example = steveo.task('example-task', async ({ name }) => {
    console.log(`hello ${name}`);
  });

  await example.publish({ name: 'tommo' });
  await example.publish({ name: 'bazza' });

  // or
  steve.publish('example-task', { name: 'tim' });

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


## Architecture

On a highlevel, it works as below, Steveo has 3 main components

You publish a message to a queue for a defined task.

Error Handling: Steveo provides mechanisms to handle errors during task processing. It emits events for task failures and connection failures, allowing you to implement appropriate error handling strategies.

### Task

Holds the information about the type of task. It has below methods,

- publish - send a message onto a queue
- subscribe - process a message

### Registry

Task Registry: Steveo maintains a registry that keeps track of tasks and their associated event handlers. When a new task is created, it is added to the registry for dispatch handling.

Responsible for keeping the inventory of tasks & event manager. Whenever a new task is created, an entry will be added in the registry

### Consumer

Responsible for consuming messages,

- `process` method initialize group consumers and start to consume the messages. It will then call the subscribe callback set on the task



```
              +-----------+     +-----------+     +-----------+
              |           |     |           |     |           |
PUBLISH ----->|   TASK    |     | REGISTRY  |     |   CONSUMER |-----> RECEIVE
              |           |     |           |     |           |
              |           |     |           |     |           |
              +-----------+     +-----------+     +-----------+
```

## Events

Event Emission: Steveo emits various events during task processing, allowing you to handle different stages of task execution, such as receiving a message, completing a task, or encountering failures.

Emitting events based on success/failures


| Event                     |                      Description                       |
|---------------------------|:------------------------------------------------------:|
| runner_receive            |                   Received a message                   |
| runner_complete           |         Completed running the associated task          |
| runner_failure            |           Failed running the associated task           |
| runner_connection_failure |      Error while polling for message (Kafka only)      |
| task_send                 |                                                        |
| task_success              |                                                        |
| task_failure              |                                                        |
| task_added                |                                                        |
| task_removed              |                                                        |
| producer_success          |                                                        |
| producer_failure          |                                                        |
| pool_reserve              |  When a consumer reserves a handle in the worker pool  |
| pool_release              | When a consumer releases a handle from the worker pool |

## Scheduler

This repo also contains two schedulers for scheduling tasks.
## What?

This is a lib that makes it quick and easy to set up an in-process job queue.

This ships two version, one for use with a sequelize app, one for use with a prisma app

It's tightly coupled Postgres so if that isn't your persistence layer, look elsewhere.

You won't get as robust a solution as you could build on top of an actual distributed message queue, but it'll get you out of a tight spot. It's safe for multiple publishers and consumers to run against concurrently.

## What's needed?

Needs a jobs table to be created. See `prisma/migrations` or `sequelize/migrations` in the individual packages

## How?

See `apps/example/bin/jobs` and `apps/src/index`

For prisma, you will need take the `prisma/prisma/schema.prisma` add put it into your app `prisma/schema.prisma` file. Prisma has no way to share or import schemas from packages.
