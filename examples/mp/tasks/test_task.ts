import logger from '../logger';
import steveo from '../steveo';

export const firstTask = steveo.task('test-topic', ({ payload }) => {
  logger.info(`processing first ${payload}`);
});

export default firstTask;
