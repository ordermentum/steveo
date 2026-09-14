import pino from 'pino';
import { Steveo } from 'steveo';
import steveoConfig from './config.js';

const logger = pino({ name: 'consumer' });

(async () => {
  const config = steveoConfig[process.env.ENGINE];

  if (!config) {
    return;
  }

  const steveo = new Steveo(config, logger);

  steveo.events.on('runner_failure', (topic, ex) => {
    logger.error({ topic, err: ex }, 'Failed to call subscribe');
  });

  // subscribe Call for first task
  const subscribe = async payload => {
    logger.info({ payload }, 'Payload from producer');
  };

  // create first Task
  steveo.task('test-topic', subscribe);
  steveo.task('test-spam', subscribe);

  // initialize consumer
  await steveo.runner().process(['test-topic', 'test-spam']);
})().catch(ex => {
  logger.debug({ err: ex }, 'Exception');
  process.exit();
});
