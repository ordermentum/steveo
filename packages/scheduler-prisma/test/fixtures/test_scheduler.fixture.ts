import { createLogger } from 'bunyan';
import { SinonSandbox } from 'sinon';
import { PrismaClient } from '@prisma/client';
import { JobScheduler, Tasks } from '../../src/index';

/**
 * Factory that creates a new JobScheduler instance for testing purposes
 */
export function createTestScheduler(
  sandbox: SinonSandbox,
  props: { tasks: Tasks }
) {
  const logger = createLogger({ name: 'test-scheduler' });
  const mockPrisma = sandbox.createStubInstance(PrismaClient);

  // sandbox.stub(models, 'default').callsFake(initSequelizeStub);

  return new JobScheduler({
    client: mockPrisma,
    logger,
    jobsSafeToRestart: [],
    jobsRiskyToRestart: [],
    jobsCustomRestart: {},
    tasks: props.tasks,
  });
}
