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
  const steveo = Steveo(config, console)();

  // create first Task
  const firstTask = steveo.task();

  // define Task
  firstTask.define('test-topic', () => {});

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
