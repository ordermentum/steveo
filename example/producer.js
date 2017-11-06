const Steveo = require('../lib').default;
const exampleTask = require('./tasks/example_task'); // eslint-disable-line
const spamTask = require('./tasks/spam_task'); // eslint-disable-line

const logger = console;

(async () => {
  const steveo = Steveo.build();

  steveo.events.on('producer_failure', (topic, ex) => {
    logger.log('Failed to produce message', topic, ex);
  });

  steveo.events.on('task_failure', (topic, ex) => {
    logger.log('Failed task', topic, ex);
  });

  let counter = 0;
  // let it run & publish messages in every second
  function produceMessages() {
    if (counter < 10000) {
      setTimeout(async () => {
        counter += 1;
        logger.log('Produce: Message ', counter);
        await exampleTask.publish([{ payload: `Message ${counter}` }]);
        await spamTask.publish([{ payload: `Message ${counter}` }]);
        produceMessages();
      }, 100);
    }
  }
  produceMessages();
})().catch((ex) => {
  logger.log('Exception', ex);
  process.exit();
});
