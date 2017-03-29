const Steveo = require('steveo').default;
const { kafkaCompression } = require('steveo');

const publishCallback = {
  success: (topic, payload) => console.log(topic, payload, 'Yaaay success'),
  failure: (topic, payload) => console.log(topic, payload, 'Ohhh failed'),
};

const config = {
  kafkaConnection: process.env.KAFKA_CONNECTION,
  kafkaCodec: kafkaCompression.GZIP,
  clientId: '1234-123',
  logLevel: 5,
  kafkaGroupId: '1234',
  kafkaSendAttempts: process.env.KAFKA_SEND_ATTEMPTS,
  kafkaSendDelayMin: process.env.KAFKA_SEND_DELAY_MIN,
  kafkaSendDelayMax: process.env.KAFKA_SEND_DELAY_MAX,
  publishCallback,
};

(async () => {
  const steveo = Steveo(config, console);

  // subscribe Call for first task
  const subscribe = async (payload) => {
    console.log('Payload from first producer', payload);
  };

  // create first Task
  const firstTask = steveo.task();

  // define Task
  firstTask.define('test-topic', subscribe);

  // subscribe Call for second task
  const subscribe2 = async (payload) => {
    console.log('Payload from second producer', payload);
  };

  // create second Task
  const secondTask = steveo.task();

  // define Task
  secondTask.define('another-test-topic', subscribe2);

  // start the runner now
  await steveo.runner.process();

  // publish some data
  await firstTask.publish({ task1: 'Task 1 Payload' });
  await secondTask.publish({ task2: 'Task 2 Payload' });

  // get lag for topics
  let lag;
  setTimeout(async () => {
    lag = await steveo.lag('1234', 'test-topic', [0]);
    console.log('*******LAG1*******', lag);
  }, 2000);

  setTimeout(async () => { // eslint-disable-line
    lag = await steveo.lag('1234', 'another-test-topic', [0]);
    console.log('*******LAG2*******', lag);
  }, 2000);
})().catch((ex) => {
  console.log('Exception', ex);
  process.exit();
});
