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

Steveo is a comprehensive framework for handling background job processing in Node.js. It offers support for popular messaging systems such as Kafka, SQS, and Redis.

In Australian culture, it is common to abbreviate names, like "John" becoming "Johno," or add extra vowels, like "Sarah" becoming "Sazza." The name "Steveo" is a playful play on "Steve" inspired by Steve Jobs.

The primary purpose of Steveo is to handle asynchronous task processing. It allows you to define tasks that involve time-consuming operations without causing a blockage in the main execution flow of an HTTP request. Think of it as [sidekiq](https://github.com/mperham/sidekiq) for node.js with support for multiple backends.

Steveo also bundles a task scheduling framework for Postgresql as an optional addon.

## Installation

This is a Node.js module available through the npm registry.

Before installing, download and install Node.js. Node.js 16  or higher is required.

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


## Packages

| Package             |                                Description                                |
|---------------------|:-------------------------------------------------------------------------:|
| steveo              | Core steveo package that provides the async task processing functionality |
| @steveojs/newrelic  |             New Relic addon for Steveo to provide APM tracing             |
| @steveojs/sentry    |            Sentry addon to provide tracing and error tracking             |
| @steveojs/statsd    |            Statsd addon to provide metrics to a statsd server             |
| @steveojs/prisma    |                      Job Scheduler using Prisma ORM                       |
| @steveojs/sequelize |                     Job Scheduler using Sequelize ORM                     |
|                     |                                                                           |

## Scheduler

This repo also contains two schedulers for scheduling tasks using postgresql (prisma and sequelize).

Needs a jobs table to be created. See `packages/prisma/migrations` or `packages/sequelize/migrations` in the individual packages

## How?

See `apps/example/bin/jobs` and `apps/src/index`

For prisma, you will need take the `prisma/prisma/schema.prisma` add put it into your app `prisma/schema.prisma` file. Prisma has no way to share or import schemas from packages.
