### Example app for testing Steveo

It creates a docker app which is using a node application. It also has containers for `kafka` and `zookeeper`

Steps:

  - Run `docker-compose build app`
  - Run `docker-compose up app` (it will exit but will link zookeeper, kafka & app)
  - Run `docker-compose run kafka bash`
  - Navigate to `opt/kafka-<version>/bin`
  - Run
    ```shell
    ./kafka-topics.sh --topic test-topic --create --zookeeper zookeeper:2181 --partitions 1 --replication-factor 1
    ./kafka-topics.sh --topic another-test-topic --create --zookeeper zookeeper:2181 --partitions 1 --replication-factor 1
    ```
  - Exit from kafka & Run `docker-compose run app bash`
  - Run `node index.js`

  Output will be as below,

  ```shell
  root@f5946f7ccd03:/usr/src/app# node index
  initializing consumer [ 'test-topic', 'another-test-topic' ]
  2017-03-29T04:35:39.490Z INFO 1234-123 Joined group 1234 generationId 1 as 1234-123-fee6cabc-b767-4f8c-81ff-1699a20b1304
  2017-03-29T04:35:39.491Z INFO 1234-123 Elected as group leader
  2017-03-29T04:35:39.515Z DEBUG 1234-123 Subscribed to another-test-topic:0 offset 33 leader kafka:9092
  2017-03-29T04:35:39.516Z DEBUG 1234-123 Subscribed to test-topic:0 offset 31 leader kafka:9092
  test-topic { task1: 'Task 1 Payload' } Yaaay success
  another-test-topic { task2: 'Task 2 Payload' } Yaaay success
  Payload from second producer { task2: 'Task 2 Payload', timestamp: 1490762139 }
  Payload from first producer { task1: 'Task 1 Payload', timestamp: 1490762139 }
  *******LAG1******* [ { topic: 'test-topic',
      partition: 0,
      offset: 32,
      highwaterMark: 32,
      consumerLag: 0 } ]
  *******LAG2******* [ { topic: 'another-test-topic',
      partition: 0,
      offset: 34,
      highwaterMark: 34,
      consumerLag: 0 } ]

  ```
