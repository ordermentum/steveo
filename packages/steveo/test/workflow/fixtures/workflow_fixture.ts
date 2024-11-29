import sinon from 'sinon';
import { fromStub, stubInterface } from '@salesforce/ts-sinon';
import { Workflow } from '../../../src/runtime/workflow';
import { Repositories, Storage } from '../../../src/types/storage';
import { IProducer, IRegistry } from '../../../src/common';
import { MemoryStateRepository } from './repo_fixture';
import { consoleLogger } from '../../../src/lib/logger';

/**
 *
 */
export function workflowFixture(sandbox: sinon.SinonSandbox) {
  const repository = new MemoryStateRepository();
  const repos: Repositories = {
    workflow: repository,
  };
  const storage = stubInterface<Storage>(sandbox, {
    transaction: (fn: (repos: Repositories) => Promise<void>): Promise<void> =>
      fn(fromStub(repos)),
  });
  const registry = stubInterface<IRegistry>(sandbox);
  const producer = stubInterface<IProducer>(sandbox);

  sinon.fake(storage.transaction);

  const workflow = new Workflow({
    name: 'test-workflow',
    topic: 'test-topic',
    storage: fromStub(storage),
    registry: fromStub(registry),
    producer: fromStub(producer),
    options: {
      serviceId: 'test-service',
    },
    logger: consoleLogger,
  });

  return { workflow, repository };
}
