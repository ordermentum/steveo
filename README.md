#### Steveo

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

