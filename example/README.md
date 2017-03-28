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
  root@2f9d15302906:/usr/src/app# node index.js
  initializing consumer [ 'test-topic' ]
  2017-03-28T06:57:12.328Z INFO '1234-234' Joined group 1234 generationId 1 as '1234-234'-5d1420d6-c9b1-4ebd-8060-5118a9c7fef7
  2017-03-28T06:57:12.328Z INFO '1234-234' Elected as group leader
  2017-03-28T06:57:12.359Z DEBUG '1234-234' Subscribed to test-topic:0 offset 181 leader kafka:9092
  Message  {
    "here": "is first payload"
  }  arrived on topic:  test-topic

          *****PRODUCE********
          topic:- test-topic
          ********************
          payload:- {"here":"is first payload"}
          ********************

  FROM PRODUCER test-topic { here: 'is first payload' }
  test-topic { here: 'is first payload' } Yaaay success
  initializing consumer [ 'test-topic', 'another-test-topic' ]

          *****CONSUME********
          topic:- test-topic
          ********************
          payload:- {"here":"is first payload","timestamp":1490684232}
          ********************

  First producer payload { here: 'is first payload', timestamp: 1490684232 }
  2017-03-28T06:57:13.384Z INFO '1234-234' Rejoining group on RebalanceInProgress
  2017-03-28T06:57:13.389Z INFO '1234-234' Joined group 1234 generationId 2 as '1234-234'-5d1420d6-c9b1-4ebd-8060-5118a9c7fef7
  2017-03-28T06:57:13.389Z INFO '1234-234' Elected as group leader
  2017-03-28T06:57:13.397Z INFO '1234-234' Joined group 1234 generationId 2 as '1234-234'-574a3543-f4a3-4b45-894c-a880d0019f22
  2017-03-28T06:57:13.405Z WARN '1234-234' No partition assignment received
  2017-03-28T06:57:13.422Z DEBUG '1234-234' Subscribed to another-test-topic:0 offset 149 leader kafka:9092
  2017-03-28T06:57:13.422Z DEBUG '1234-234' Subscribed to test-topic:0 offset 182 leader kafka:9092
  Message  {
    "here": "is second payload"
  }  arrived on topic:  another-test-topic

          *****PRODUCE********
          topic:- another-test-topic
          ********************
          payload:- {"here":"is second payload"}
          ********************

  FROM PRODUCER another-test-topic { here: 'is second payload' }
  another-test-topic { here: 'is second payload' } Yaaay success

          *****CONSUME********
          topic:- another-test-topic
          ********************
          payload:- {"here":"is second payload","timestamp":1490684233}
          ********************

  Second producer payload { here: 'is second payload', timestamp: 1490684233 }
  *******LAG******* [ { topic: 'test-topic',
      partition: 0,
      offset: 182,
      highwaterMark: 182,
      consumerLag: 0 } ]
  *******LAG******* [ { topic: 'another-test-topic',
      partition: 0,
      offset: 150,
      highwaterMark: 150,
      consumerLag: 0 } ]
  ^C
  root@2f9d15302906:/usr/src/app#
  ```
