const Steveo = require('steveo').default;
const { kafkaCompression } = require('steveo');

const config = {
  kafkaConnection: process.env.KAFKA_CONNECTION,
  kafkaCodec: kafkaCompression.GZIP,
  clientId: '1234-123',
  logLevel: 5,
  kafkaGroupId: '1234',
  kafkaSendAttempts: process.env.KAFKA_SEND_ATTEMPTS,
  kafkaSendDelayMin: process.env.KAFKA_SEND_DELAY_MIN,
  kafkaSendDelayMax: process.env.KAFKA_SEND_DELAY_MAX,
};

(async () => {
  const steveo = Steveo(config, console);

  // subscribe Call for first task
  const subscribe = async (payload) => {
    console.log('Payload from producer', payload);
  };

  // create first Task
  const firstTask = steveo.task();

  // define Task
  firstTask.define('test-topic', subscribe);

  // initialize consumer
  await steveo.runner().process();
})().catch((ex) => {
  console.log('Exception', ex);
  process.exit();
});
