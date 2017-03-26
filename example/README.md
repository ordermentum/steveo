### Example app for testing Steveo

It creates a docker app which is using a node application. It also has containers for `kafka` and `zookeeper`

Steps:

  - Run `docker-compose build app`
  - Run `docker-compose run app bash`
  - Run `node index.js`

  Output will be as below,

  ```shell
  root@67bcb5a80437:/usr/src/app# node index.js
  initializing consumer [ 'test-topic' ]
  Message  {
    "here": "is a payload"
  }  arrived on topic:  test-topic
  ***** { timestamp: 1490530056,
    topic: 'test-topic',
    message: { value: '{"here":"is a payload","timestamp":1490530056}' } }
  ```
