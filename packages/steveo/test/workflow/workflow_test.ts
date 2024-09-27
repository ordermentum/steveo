import sinon from 'sinon';
import { fromStub, stubInterface } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { consoleLogger } from '../../src/lib/logger';
import { Workflow } from '../../src/runtime/workflow';
import { Repositories, Storage } from '../../src/storage/storage';
import { IProducer, IRegistry } from '../../src/common';
import { fixtures } from './fixtures/state_fixtures';
import { MemoryStateRepository } from './fixtures/repo_fixture';

// Workflow integration tests
describe('Workflow tests', () => {
  const sandbox = sinon.createSandbox();
  const workflowRepo = new MemoryStateRepository();
  const repos: Repositories = {
    workflow: workflowRepo,
  };
  const storage = stubInterface<Storage>(sandbox, {
    transaction: (fn: (repos: Repositories) => Promise<void>): Promise<void> =>
      fn(fromStub(repos)),
  });
  const registry = stubInterface<IRegistry>(sandbox);
  const producer = stubInterface<IProducer>(sandbox);
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

  sinon.fake(storage.transaction);

  beforeEach(() => {
    sinon.reset();
  });

  it('should execute a simple one step flow', async () => {
    // ARRANGE
    const step1 = fixtures.stepReturn('step-1', 'step1-result');

    workflow.next(step1.step);

    // ACT
    await workflow.subscribe({});

    // ASSERT
    expect(step1.fake.callCount).to.eq(1);
    expect(workflowRepo.calls.init).to.eq(1);
    expect(workflowRepo.calls.completed).to.eq(1);
  });

  it('should execute two step flow', async () => {
    // ARRANGE
    const step1 = fixtures.stepReturn('step-1', 'step1-result');
    const step2 = fixtures.stepReturn('step-2', 'step2-result');

    workflow.next(step1.step);
    workflow.next(step2.step);

    // ACT
    await workflow
      .subscribe({})
      .then(workflowId => workflow.subscribe({ workflowId }));

    // ASSERT
    expect(step1.fake.callCount).to.eq(1);
    expect(workflowRepo.calls.init).to.eq(1);
    expect(workflowRepo.calls.completed).to.eq(1);
  });

  it('should execute rollback sequence on irretrievable step error', async () => {
    // ARRANGE
    const step1 = fixtures.stepReturn('step-1', 'step1-result');
    const step2 = fixtures.stepThrow('step-2', 'Expected test error');

    workflow.next(step1.step);
    workflow.next(step2.step);

    // ACT
    const workflowId = await workflow.subscribe({});

    await workflow.subscribe({ workflowId });

    // ASSERT
    expect(step1.fake.callCount).to.eq(1);
    expect(workflowRepo.calls.init).to.eq(1);
    expect(workflowRepo.calls.load).to.eq(2);
    expect(workflowRepo.calls.completed).to.eq(0);
    expect(workflowRepo.calls.rollbacks).to.eq(2);
    expect(workflowRepo.calls.errors).to.eq(1);
  });

  it('should detect out of order step execution', async () => {
    // TODO: Implement with example app
  });

  it('should detect step re-execution', async () => {
    // TODO: Implement with example app
  });
});
