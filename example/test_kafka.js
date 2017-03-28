const Kafka = require('no-kafka');

(async () => {
  const consumer = new Kafka.GroupConsumer({
    groupId: '1234',
    clientId: 'abcd',
    connectionString: 'kafka://kafka:9092',
    codec: Kafka.COMPRESSION_GZIP,
    logger: {
      logLevel: 5,
    },
  });

  const producer = new Kafka.Producer({
    connectionString: 'kafka://kafka:9092',
    codec: Kafka.COMPRESSION_GZIP,
  });

  const receive = (messageSet, topic, partition) => {
    return Promise.all(messageSet.map(async (m) => {
      console.log('______RECEIEVE_____', m.message.value.toString('utf8'), topic, partition);
      await consumer.commitOffset({ topic, partition, offset: m.offset, metadata: 'optional' });
    }));
  };

  await producer.init();
  await consumer.init({ subscriptions: ['test-topic'], handler: receive });

  const sendParams = {
    retries: {
      attempts: 2,
      delay: {
        min: 100,
        max: 300,
      },
    },
  };

  const data = {
    timestamp: '651265412',
    topic: 'test-topic',
    message: { value: 'second' },
  };

  await producer.send(data, sendParams);
})();

