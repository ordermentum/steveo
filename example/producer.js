const Steveo = require('steveo').default;

const config = {
  kafkaConnection: process.env.KAFKA_CONNECTION,
  clientId: '1234-123',
  engine: 'kafka',
};

(async () => {
  const steveo = Steveo(config, console)();

  steveo.events.on('producer_failure', (topic, ex) => {
    console.log('Failed to produce message', topic, ex);
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
