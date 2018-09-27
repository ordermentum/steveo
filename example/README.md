## Example app for testing Steveo

It creates a docker app which is using a node application.

It also has containers for `kafka` and `zookeeper`

#### Build docker container
  - Run `docker-compose build app`
  - Run `docker-compose up app` (it will exit but will link zookeeper, kafka & app)


### `Kafka` Engine

#### Create topic in `Kafka`

  - Run `docker-compose run kafka bash`
  - Navigate to `opt/kafka-<version>/bin`
  - Run
    ```shell
    ./kafka-topics.sh --topic test-topic --create --zookeeper zookeeper:2181 --partitions 2 --replication-factor 1
    ```
  - Above steps will create topic `test-topic` with 2 partitions
  - Exit from kafka

#### Connect to container
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

### `SQS` Backend

#### Connect to container
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

### `Redis` Backend

#### Connect to container
  - Run `docker-compose run app bash`

#### Start `redis` producer
  ```shell
  root@57f35557fe6b:/usr/src/app# ENGINE=redis node producer.js
  Produce: Message  1
  Redis Publish Data { qname: 'test-topic',
    message: '{"payload":"Message 1","timestamp":1498647318149}',
    delay: 0 } id er852naugvE35vCeVSqCSbx89BVogTW3
  Queue status { vt: 20,
    delay: 0,
    maxsize: 1024,
    totalrecv: 426,
    totalsent: 427,
    created: 1498632439,
    modified: 1498632439,
    msgs: 1,
    hiddenmsgs: 1 }
  ```

#### Start Consumer
  ```shell
  root@83df25a76b71:/usr/src/app# ENGINE=redis node consumer.js

  initializing consumer [ 'test-topic' ]
  initializing consumer test-topic
  Message from redis { id: 'er85888ojiiTFUHNHkjSGTdH2KTGUsJq',
    message: '{"payload":"Message 1","timestamp":1498647655650}',
    rc: 1,
    fr: 1498647660359,
    sent: 1498647655654 }
  Deleting message test-topic { payload: 'Message 1', timestamp: 1498647655650 }
  Start subscribe test-topic { payload: 'Message 1', timestamp: 1498647655650 }
  Payload from producer { payload: 'Message 1', timestamp: 1498647655650 }
  Message from redis { id: 'er8588v18wSjAYFLKBZmguioX9ZNwsgR',
    message: '{"payload":"Message 2","timestamp":1498647656692}',
    rc: 1,
    fr: 1498647660380,
    sent: 1498647656697 }
  ```




