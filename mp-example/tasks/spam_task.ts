import logger from '../logger';
import steveo from '../steveo';

export const secondTask = steveo.task('test-spam', ({ payload }) => {
  logger.info(`processing ${payload}`);
});

export default secondTask;
