const Steveo = require('../../lib').default;
const bunyan = require('bunyan');
const steveoConfig = require('./config');

const logger = bunyan.createLogger({ name: 'consumer' });

(async () => {
  const config = steveoConfig[process.env.ENGINE];

  if (!config) {
    return;
  }

  const steveo = Steveo(config, logger)();

  steveo.events.on('runner_failure', (topic, ex) => {
    logger.info('Failed to call subscribe', topic, ex);
  });

  // subscribe Call for first task
  const subscribe = async payload => {
    logger.info('Payload from producer', payload);
  };

  // create first Task
  steveo.task('test-topic', subscribe);
  steveo.task('test-spam', subscribe);

  // initialize consumer
  await steveo.runner().process(['test-topic', 'test-spam']);
})().catch(ex => {
  logger.debug('Exception', ex);
  process.exit();
});
