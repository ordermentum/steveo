# Lunartick
[![npm version](https://badge.fury.io/js/steveo.svg)](https://badge.fury.io/js/steveo)
[![Build Status](https://travis-ci.org/ordermentum/steveo.svg?branch=master)](https://travis-ci.org/ordermentum/steveo)
[![dependencies Status](https://david-dm.org/ordermentum/steveo/status.svg)](https://david-dm.org/ordermentum/steveo)
[![devDependencies Status](https://david-dm.org/ordermentum/steveo/dev-status.svg)](https://david-dm.org/ordermentum/steveo?type=dev)
[![npm](https://img.shields.io/npm/l/steveo.svg)](https://www.npmjs.com/package/steveo)
[![npm](https://img.shields.io/npm/dt/steveo.svg)](https://www.npmjs.com/package/steveo)



Status: WIP

Steveo is a "JOB" management library for Kafka

On a highlevel, it works as below, Steveo will have 3 main factory components

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
  - define
  - publish
  - subscribe

### Registry

Responsible for keeping the inventory of tasks. Whenever a new task is created, an entry will be added in the registry

### Runner

Responsible for sending messages to Kafka & Receive message from Kafka.
  - Task factory uses `send` method on `Runner` to send the message to kafka with a payload
  - When a kafka emits a message, `Runner` will listen to it and call the subscribe callback from `Task`

