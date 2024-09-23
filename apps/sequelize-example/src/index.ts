// @ts-nocheck
import { JobScheduler } from '@ordermentum/steveo';
import config from 'config';
import registerSteveoTask from './tasks/taskThatRunsWithSteveoAndUsesTaskHelper';
import { exampleTask2 } from './tasks/taskThatOnlyUsesSteveo';
import exampleTask3 from './tasks/taskThatDoesnotUseSteveo';
import { logger } from './logger';

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
