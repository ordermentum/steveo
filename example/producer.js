const Steveo = require('steveo').default;

const sqsConfig = {
  region: process.env.AWS_REGION,
  apiVersion: '2012-11-05',
  receiveMessageWaitTimeSeconds: '20',
  messageRetentionPeriod: '604800',
  engine: 'sqs',
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  MaxNumberOfMessages: 1,
  VisibilityTimeout: 180,
  WaitTimeSeconds: 20,
};

const kafkaConfig = {
  kafkaConnection: process.env.KAFKA_CONNECTION,
  clientId: '1234-123',
};

const steveoConfig = {
  kafka: kafkaConfig,
  sqs: sqsConfig,
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

  steveo.events.on('task_failure', (topic, ex) => {
    logger.log('Failed task', topic, ex);
  });

  const attributes = [{
    name: 'Hello',
    value: 'world',
    dataType: 'String',
  }];
  // create first Task
  const firstTask = steveo.task('test-topic', () => {}, attributes);

  // let it run & publish messages in every second
  function produceMessages(counter) {
    if (counter < 1000) {
      setTimeout(async () => {
        counter += 1; // eslint-disable-line
        logger.log('Produce: Message ', counter);
        await firstTask.publish([{ payload: `Message ${counter}` }]);
        produceMessages(counter);
      }, 1000);
    }
  }
  produceMessages(0);
})().catch((ex) => {
  logger.log('Exception', ex);
  process.exit();
});
