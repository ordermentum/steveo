// @ts-nocheck
import { JobScheduler } from '@steveojs/scheduler-prisma';
import pino from 'pino';
import exampleTask from './example_task.js';
import { client } from './client.js';

const logger = pino({ name: 'example-job' });

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
