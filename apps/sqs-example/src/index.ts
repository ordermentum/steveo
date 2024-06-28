// @ts-nocheck
import config from 'config';
import { logger } from './logger';
import steveo from './steveo_sqs';
import fifoTask from './tasks/fifo_example_task';

// const activeTask = process.env.TASK;

const tasks = {
  fifo: fifoTask,
};

let active = true;
process.on('SIGINT', async () => {
  active = false;
  await steveo.stop();
});

process.on('unhandledRejection', (reason, promise) => {
  steveo.logger.error('Unhandled Rejection', { reason, promise });
});

const start = async () => {
  try {
    await steveo.start();
    logger.info('consumers ready to process messages...');

    while (active) {
      const id = crypto.randomUUID();
      await tasks.fifo.publish({ message: `Hello ${id}` });
      steveo.logger.info('Published message', { id });
      await setTimeout(500);
    }
  } catch (e) {
    logger.error(e);
    process.exit(1);
  }
};

start();
