import pino from 'pino';
import { Steveo } from 'steveo';
import steveoConfig from './config.js';

const logger = pino({ name: 'producer' });

(async () => {
  const config = steveoConfig[process.env.ENGINE];

  if (!config) {
    return;
  }
  const steveo = new Steveo(config, logger);

  steveo.events.on('producer_failure', (topic, ex) => {
    logger.error({ topic, err: ex }, 'Failed to produce message');
  });

  steveo.events.on('producer_success', (topic, data) => {
    logger.info({ topic, data }, 'Message successfully produced');
  });

  steveo.events.on('task_failure', (topic, ex) => {
    logger.error({ topic, err: ex }, 'Failed task');
  });

  const attributes = [
    {
      name: 'Hello',
      value: 'world',
      dataType: 'String',
    },
  ];
  // create first Task
  const firstTask = steveo.task('test-topic', () => {}, attributes);
  const secondTask = steveo.task('test-spam', () => {}, attributes);
  await steveo.runner().createQueues();

  // let it run & publish messages in every second
  function produceMessages(counter) {
    if (counter < 10) {
      setInterval(async () => {
        counter += 1; // eslint-disable-line
        logger.info({ counter }, 'Produce: Message');
        await firstTask.publish([{ payload: `Message ${counter}` }]);
        await secondTask.publish([{ payload: `Message ${counter}` }]);
        produceMessages(counter);
      }, 1000);
    } else {
      process.exit(0);
    }
  }
  produceMessages(0);
})().catch(ex => {
  logger.error({ err: ex }, 'Exception');
  process.exit();
});
