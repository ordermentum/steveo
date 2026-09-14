// @ts-nocheck
import { JobScheduler } from '@steveojs/scheduler-sequelize';
import config from 'config';
import registerSteveoTask from './tasks/taskThatRunsWithSteveoAndUsesTaskHelper.js';
import { exampleTask2 } from './tasks/taskThatOnlyUsesSteveo.js';
import exampleTask3 from './tasks/taskThatDoesnotUseSteveo.js';
import { logger } from './logger.js';

const jobScheduler = new JobScheduler({
  logger,
  databaseUri: config.get('db.uri'),
  defaultRunInterval: config.get('defaultJobRunInterval'),
  jobsRiskyToRestart: [],
  jobsSafeToRestart: ['abandoned-carts-task', 'purge-carts-task'],
  jobsCustomRestart: {},
  tasks: {
    'example-task-2': exampleTask2,
    'example-task-3': exampleTask3,
  },
});
registerSteveoTask(jobScheduler);
export default jobScheduler;
