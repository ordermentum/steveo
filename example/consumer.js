const Steveo = require('steveo').default;

const config = {
  // kafkaConnection: process.env.KAFKA_CONNECTION,
  // clientId: '1234-123',
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


(async () => {
  const steveo = Steveo(config, console)();

  steveo.events.on('runner_failure', (topic, ex) => {
    console.log('Failed to call subscribe', topic, ex);
  });

  // subscribe Call for first task
  const subscribe = async (payload) => {
    console.log('Payload from producer', payload);
  };

  // create first Task
  steveo.task('test-topic', subscribe);

  // initialize consumer
  await steveo.runner().process();
})().catch((ex) => {
  console.log('Exception', ex);
  process.exit();
});
