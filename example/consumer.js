const Steveo = require('./lib').default;
const bunyan = require('bunyan');

const logger = bunyan.createLogger({ name: 'consumer' });

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
  kafkaConnection: process.env.KAFKA_BROKERS,
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

(async () => {
  const config = steveoConfig[process.env.ENGINE];

  if (!config) {
    return;
  }

  const steveo = Steveo(config, logger)();

  steveo.events.on('runner_failure', (topic, ex) => {
    logger.debug('Failed to call subscribe', topic, ex);
  });

  // subscribe Call for first task
  const subscribe = async payload => {
    logger.debug('Payload from producer', payload);
  };

  // create first Task
  steveo.task('test-topic', subscribe);
  steveo.task('test-spam', subscribe);

  // initialize consumer
  await steveo.runner().process(['test-topic']);
})().catch(ex => {
  logger.debug('Exception', ex);
  process.exit();
});
