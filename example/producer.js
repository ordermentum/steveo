const Steveo = require('./lib').default;

const sqsConfig = {
  region: process.env.AWS_REGION,
  apiVersion: '2012-11-05',
  receiveMessageWaitTimeSeconds: '20',
  messageRetentionPeriod: '604800',
  engine: 'sqs',
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  maxNumberOfMessages: 1,
  visibilityTimeout: 180,
  waitTimeSeconds: 20,
};

const kafkaConfig = {
  bootstrapServers: process.env.KAFKA_BROKERS,
};

const redisConfig = {
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT,
  engine: 'redis',
};

const steveoConfig = {
  kafka: kafkaConfig,
  sqs: sqsConfig,
  redis: redisConfig,
};

const logger = console;

(async () => {
  const config = steveoConfig[process.env.ENGINE];

  if (!config) {
    return;
  }
  const steveo = Steveo(config, logger)();

  steveo.events.on('producer_failure', (topic, ex) => {
    logger.log('Failed to produce message', topic, ex);
  });

  steveo.events.on('producer_success', (topic, data) => {
    logger.log('Message succesfully produced', topic, data);
  });

  steveo.events.on('task_failure', (topic, ex) => {
    logger.log('Failed task', topic, ex);
  });

  const attributes = [
    {
      name: 'Hello',
      value: 'world',
      dataType: 'String',
    },
  ];
  // create first Task
  const firstTask = steveo.task('test-topic', () => { }, attributes);
  const secondTask = steveo.task('test-spam', () => { }, attributes);
  await steveo.runner().createQueues();

  // let it run & publish messages in every second
  function produceMessages(counter) {
    if (counter < 10) {
      setInterval(async () => {
        counter += 1; // eslint-disable-line
        logger.log('Produce: Message ', counter);
        await firstTask.publish([{ payload: `Message ${counter}` }]);
        await secondTask.publish([{ payload: `Message ${counter}` }]);
        produceMessages(counter);
      }, 1000);
    } else {
      process.exit(0);
    }
  }
  produceMessages(0);
})().catch(ex => {
  logger.log('Exception', ex);
  process.exit();
});
