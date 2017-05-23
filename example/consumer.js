const Steveo = require('steveo').default;
const { kafkaCompression } = require('steveo');

const config = {
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
