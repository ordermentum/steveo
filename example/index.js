const Steveo = require('steveo').default;
const { kafkaCompression } = require('steveo');

const config = {
  kafkaConnection: process.env.KAFKA_CONNECTION,
  kafkaCodec: kafkaCompression.GZIP,
  clientId: process.env.CLIENT_ID,
  logLevel: process.env.LOG_LEVEL,
  kafkaGroupId: '1234',
  kafkaSendAttempts: process.env.KAFKA_SEND_ATTEMPTS,
  kafkaSendDelayMin: process.env.KAFKA_SEND_DELAY_MIN,
  kafkaSendDelayMax: process.env.KAFKA_SEND_DELAY_MAX,
};

(async () => {
  const steveo = Steveo(config, console);

  // wait for the kafka consumer to call the subscribe action
  const subscribe = async (payload) => {
    console.log('Here is the payload', payload);
  };

  // define task
  await steveo.task.define('test-topic', subscribe);

  // publish task
  await steveo.task.publish({ here: 'is a payload' });

  // get lag
  const lag = await steveo.fetchConsumerLag('1234', 'test-topic', [0]);

  console.log('********lag', lag);
  process.exit();
})().catch((ex) => {
  console.log('Exception', ex);
  process.exit();
});

