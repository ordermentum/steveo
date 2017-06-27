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
};

(async () => {
  const steveo = Steveo(config, console)();

  steveo.events.on('producer_failure', (topic, ex) => {
    console.log('Failed to produce message', topic, ex);
  });

  steveo.events.on('task_failure', (topic, ex) => {
    console.log('Failed task', topic, ex);
  });

  // create first Task
  const firstTask = steveo.task('test-topic', () => {});

  // let it run & publish messages in every second
  function produceMessages(counter) {
    if (counter < 1000) {
      setTimeout(async () => {
        counter += 1; // eslint-disable-line
        console.log('Produce: Message ', counter);
        await firstTask.publish([{ payload: `Message ${counter}` }]);
        produceMessages(counter);
      }, 1000);
    }
  }
  produceMessages(0);
})().catch((ex) => {
  console.log('Exception', ex);
  process.exit();
});
