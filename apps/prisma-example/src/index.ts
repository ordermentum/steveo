// @ts-nocheck
import { JobScheduler } from '@steveojs/scheduler-prisma';
import bunyan from 'bunyan';
import exampleTask from './example_task';
import { client } from './client';

const logger = bunyan.createLogger({ name: 'example-job' });

export const jobScheduler = new JobScheduler({
  client,
  defaultRunInterval: 500,
  logger,
  jobsRiskyToRestart: [],
  jobsSafeToRestart: ['example-task'],
  jobsCustomRestart: {},
  tasks: {
    'example-task': exampleTask,
  },
});

export default jobScheduler;
