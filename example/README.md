### Example app for testing Steveo

It creates a docker app which is using a node application. It also has containers for `kafka` and `zookeeper`

Steps:

  - Run `docker-compose build app`
  - Run `docker-compose up app` (it will exit but will link zookeeper, kafka & app)
  - Run `docker-compose run kafka bash`
  - Navigate to `opt/kafka-<version>/bin`
  - Run
    ```shell
    ./kafka-topics.sh --topic test-topic --create --zookeeper zookeeper:2181 --partitions 2 --replication-factor 1
    ```
  - Exit from kafka & Run `docker-compose run app bash`
  - Run `node index.js`


  Now we have 2 partitions for topic `test-topic`

  Let's test it out by using 2 consumers and 1 producer

  #### Start Producer

  ```shell
  docker-compose run app bashroot@154e6ae1ff82:/usr/src/app# node producer.js
  Produce: Message  1
  Produce: Message  2
  Produce: Message  3
  Produce: Message  4
  Produce: Message  5
  Produce: Message  6
  Produce: Message  7
  Produce: Message  8
  Produce: Message  9
  Produce: Message  10
  ```

  #### Start Consumer 1

  ```shell
  Payload from producer { payload: 'Message 7', timestamp: 1490832326 }
  2017-03-30T00:05:27.856Z INFO 1234-123 Joined group 1234 generationId 2 as 1234-123-dbeeb85f-9d94-4f78-9361-b21af834ba88
  2017-03-30T00:05:27.877Z DEBUG 1234-123 Subscribed to test-topic:0 offset 813leader kafka:9092
  ^C
  root@200341004c16:/usr/src/app# clear
  root@200341004c16:/usr/src/app# node consumer.js
  initializing consumer [ 'test-topic' ]
  2017-03-30T00:05:54.666Z INFO 1234-123 Joined group 1234 generationId 1 as 1234-123-7080105b-74e1-482a-a5c5-845b5d65a117
  2017-03-30T00:05:54.667Z INFO 1234-123 Elected as group leader
  2017-03-30T00:05:54.694Z DEBUG 1234-123 Subscribed to test-topic:0 offset 813leader kafka:9092
  2017-03-30T00:05:54.694Z DEBUG 1234-123 Subscribed to test-topic:1 offset 815leader kafka:9092
  2017-03-30T00:06:00.727Z INFO 1234-123 Rejoining group on RebalanceInProgress
  2017-03-30T00:06:00.740Z INFO 1234-123 Joined group 1234 generationId 2 as 1234-123-7080105b-74e1-482a-a5c5-845b5d65a117
  2017-03-30T00:06:00.741Z INFO 1234-123 Elected as group leader
  2017-03-30T00:06:00.767Z DEBUG 1234-123 Subscribed to test-topic:1 offset 815leader kafka:9092
  Payload from producer { payload: 'Message 2', timestamp: 1490832368 }
  Payload from producer { payload: 'Message 4', timestamp: 1490832370 }
  Payload from producer { payload: 'Message 6', timestamp: 1490832372 }
  ```

   #### Start Consumer 2

  ```shell
  root@228729b5b1be:/usr/src/app# node consumer.js
  initializing consumer [ 'test-topic' ]
  2017-03-30T00:06:00.751Z INFO 1234-123 Joined group 1234 generationId 2 as 1234-123-c6d9a7af-7f90-48c8-98e3-bba9e0810bc0
  2017-03-30T00:06:00.782Z DEBUG 1234-123 Subscribed to test-topic:0 offset 813 leader kafka:9092
  Payload from producer { payload: 'Message 1', timestamp: 1490832367 }
  Payload from producer { payload: 'Message 3', timestamp: 1490832369 }
  Payload from producer { payload: 'Message 5', timestamp: 1490832371 }
  Payload from producer { payload: 'Message 7', timestamp: 1490832373 }
  Payload from producer { payload: 'Message 9', timestamp: 1490832375 }
  Payload from producer { payload: 'Message 11', timestamp: 1490832377 }
  Payload from producer { payload: 'Message 13', timestamp: 1490832379 }
  Payload from producer { payload: 'Message 15', timestamp: 1490832381 }
  Payload from producer { payload: 'Message 17', timestamp: 1490832383 }
  Payload from producer { payload: 'Message 19', timestamp: 1490832385 }
  Payload from producer { payload: 'Message 21', timestamp: 1490832388 }
  Payload from producer { payload: 'Message 23', timestamp: 1490832390 }
  Payload from producer { payload: 'Message 25', timestamp: 1490832392 }
  Payload from producer { payload: 'Message 27', timestamp: 1490832394 }
  Payload from producer { payload: 'Message 29', timestamp: 1490832396 }
  Payload from producer { payload: 'Message 31', timestamp: 1490832398 }
  Payload from producer { payload: 'Message 33', timestamp: 1490832400 }
  Payload from producer { payload: 'Message 35', timestamp: 1490832402 }
  Payload from producer { payload: 'Message 37', timestamp: 1490832404 }
  Payload from producer { payload: 'Message 39', timestamp: 1490832406 }
  Payload from producer { payload: 'Message 41', timestamp: 1490832408 }
  Payload from producer { payload: 'Message 43', timestamp: 1490832410 }
  Payload from producer { payload: 'Message 45', timestamp: 1490832412 }
  Payload from producer { payload: 'Message 47', timestamp: 1490832414 }
  Payload from producer { payload: 'Message 49', timestamp: 1490832416 }
  ```


