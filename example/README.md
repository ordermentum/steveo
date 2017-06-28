## Example app for testing Steveo

It creates a docker app which is using a node application.

It also has containers for `kafka` and `zookeeper`

#### Build docker container
  - Run `docker-compose build app`
  - Run `docker-compose up app` (it will exit but will link zookeeper, kafka & app)

#### Create topic in `kafka`

  - Run `docker-compose run kafka bash`
  - Navigate to `opt/kafka-<version>/bin`
  - Run
    ```shell
    ./kafka-topics.sh --topic test-topic --create --zookeeper zookeeper:2181 --partitions 2 --replication-factor 1
    ```
  - Above steps will create topic `test-topic` with 2 partitions
  - Exit from kafka

#### Run `steveo` using kafka backend
  - Run `docker-compose run app bash`

#### Start `kafka` producer
  ```shell
  root@57f35557fe6b:/usr/src/app# ENGINE=kafka node producer.js
  Produce: Message  1
  Payload Size: test-topic 49
  ```

#### Start Consumer
  ```shell
  root@83df25a76b71:/usr/src/app# ENGINE=kafka node consumer.js
  initializing consumer [ 'test-topic' ]
  2017-06-28T00:20:46.247Z INFO 1234-123 Joined group STEVEO_TASKS generationId 1 as 1234-123-b064107a-7383-4883-8831-df279eff84ef
  2017-06-28T00:20:46.249Z INFO 1234-123 Elected as group leader
  2017-06-28T00:20:46.289Z DEBUG 1234-123 Subscribed to test-topic:0 offset 269 leader 172.17.0.1:9092
  Start subscribe test-topic { payload: 'Message 1', timestamp: 1498609251252 }
  Payload from producer { payload: 'Message 1', timestamp: 1498609251252 }
  Finish subscribe test-topic { payload: 'Message 1', timestamp: 1498609251252 }
  ```

#### Run `steveo` using SQS backend
  - Run `docker-compose run app bash`

#### Start `sqs` producer
  ```shell
  root@57f35557fe6b:/usr/src/app# ENGINE=sqs node producer.js
  Produce: Message  1
  SQS Publish Data { ResponseMetadata: { RequestId: 'd14d6482-950d-5836-91ff-354e6c715720' },
    MD5OfMessageBody: 'ebae47e466456b6dad60cfc8d04bc510',
    MD5OfMessageAttributes: '52b3d132bbd04ee6322882f3e2ee4003',
    MessageId: '83b29ebc-2c9d-466b-8d35-afb3d1ff2ec6' }
  ```

#### Start Consumer
  ```shell
  root@83df25a76b71:/usr/src/app# ENGINE=sqs AWS_ACCESS_KEY=AKAISOMETHING AWS_SECRET_ACCESS_KEY=reallylongs3cr3tk3y node consumer.js

  initializing consumer [ 'test-topic' ]
  queueURL for topic test-topic is https://sqs.ap-southeast-2.amazonaws.com/hahhahahaha/test-topic
  initializing consumer test-topic { MaxNumberOfMessages: 1,
    QueueUrl: 'https://sqs.ap-southeast-2.amazonaws.com/againhahhaha/test-topic',
    VisibilityTimeout: 180,
    WaitTimeSeconds: 20 }
  Deleting message test-topic { payload: 'Message 1', timestamp: 1498609468761 }
  Start subscribe test-topic { payload: 'Message 1', timestamp: 1498609468761 }
  Payload from producer { payload: 'Message 1', timestamp: 1498609468761 }
  ```




