const Steveo = require('steveo').default;
const { kafkaCompression } = require('steveo');

const publishCallback = {
  success: (topic, payload) => console.log(topic, payload, 'Yaaay success'),
  failure: (topic, payload) => console.log(topic, payload, 'Ohhh failed'),
};

const config = {
  kafkaConnection: process.env.KAFKA_CONNECTION,
  kafkaCodec: kafkaCompression.GZIP,
  clientId: process.env.CLIENT_ID,
  logLevel: process.env.LOG_LEVEL,
  kafkaGroupId: '1234',
  kafkaSendAttempts: process.env.KAFKA_SEND_ATTEMPTS,
  kafkaSendDelayMin: process.env.KAFKA_SEND_DELAY_MIN,
  kafkaSendDelayMax: process.env.KAFKA_SEND_DELAY_MAX,
  publishCallback,
};

(async () => {
  const steveo = Steveo(config, console);

  // wait for the kafka consumer to call the subscribe action
  const subscribe = async (payload) => {
    console.log('First producer payload', payload);
  };

  // task
  const task = steveo.task();
  // define task
  await task.define('test-topic', subscribe);

  // publish task
  await task.publish({ here: 'is first payload' });

  // get lag
  let lag;
  setTimeout(async () => {
    lag = await steveo.lag('1234', 'test-topic', [0]);
    console.log('*******LAG*******', lag);
  }, 2000);

  const subscribe2 = async (payload) => {
    console.log('Second producer payload', payload);
  };

  // task
  const task2 = steveo.task();
  // define task
  await task2.define('another-test-topic', subscribe2);

  // publish task
  await task2.publish({ here: 'is second payload' });

  setTimeout(async () => {
    lag = await steveo.lag('1234', 'another-test-topic', [0]);
    console.log('*******LAG*******', lag);
  }, 2000);
})().catch((ex) => {
  console.log('Exception', ex);
  process.exit();
});
