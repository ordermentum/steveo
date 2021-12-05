import logger from './logger';
import steveo from './steveo';

import firstTask from './tasks/test_task';
import spamTask from './tasks/spam_task';

const load = async () => {
  steveo.events.on('producer_failure', (topic, ex) => {
    logger.info('Failed to produce message', topic, ex);
  });

  steveo.events.on('producer_success', (topic, data) => {
    logger.info('Message succesfully produced', topic, data);
  });

  steveo.events.on('task_failure', (topic, ex) => {
    logger.info('Failed task', topic, ex);
  });

  await steveo.runner().createQueues();
  // let it run & publish messages in every 5 seconds
  setInterval(async () => {
    console.log('publishing');
    await firstTask.publish([{ payload: `Message` }]);
    await spamTask.publish([{ payload: `Message` }]);
  }, 1000);
  await steveo.start();
};

load();
