import { createLogger } from 'bunyan';
import { SinonSandbox } from 'sinon';
import * as models from '../../src/models/index';
import { JobScheduler, Tasks } from '../../src/index';

/**
 * Factory that creates a new JobScheduler instance for testing purposes
 */
export function createTestScheduler(
  sandbox: SinonSandbox,
  props: { tasks: Tasks }
) {
  const logger = createLogger({ name: 'test-scheduler' });
  const initSequelizeStub = sandbox.stub().returns({});

  sandbox.stub(models, 'default').callsFake(initSequelizeStub);

  return new JobScheduler({
    databaseUri: 'sqlite::memory:',
    logger,
    jobsSafeToRestart: [],
    jobsRiskyToRestart: [],
    jobsCustomRestart: {},
    tasks: props.tasks,
  });
}
