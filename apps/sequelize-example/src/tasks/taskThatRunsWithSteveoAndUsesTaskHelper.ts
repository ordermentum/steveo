// @ts-nocheck
import { JobScheduler } from '@ordermentum/steveo';
import steveo from '../steveo_sqs';

export const callback = async () => {};

export default (jobScheduler: JobScheduler) => {
  const task = jobScheduler.taskHelper('example-task')(callback);
  const publishableTask = steveo.task<void, void>('example-task', task);
  jobScheduler.registerTask('example-task', publishableTask);
};
