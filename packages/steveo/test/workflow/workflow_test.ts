import sinon from 'sinon';
import { fromStub, stubInterface } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { consoleLogger } from '../../src/lib/logger';
import { Workflow } from '../../src/runtime/workflow';
import { Repositories, Storage } from '../../src/storage/storage';
import { IProducer, IRegistry } from '../../src/common';
import { StepUnknown } from '../../src/runtime/workflow-step';
import { WorkflowStateRepository } from '../../src/storage/workflow-repo';
import { WorkflowState } from '../../src/runtime/workflow-state';

// Workflow integration tests
describe('Workflow tests', () => {
  const sandbox = sinon.createSandbox();
  const workflowRepo = stubInterface<WorkflowStateRepository>(sandbox);
  const repos: Repositories = {
    workflow: fromStub(workflowRepo),
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
    const step1Fake = sinon.fake.returns({ value: 123 });
    const step1: StepUnknown = {
      name: 'step-1',
      execute: step1Fake,
    } as StepUnknown;

    workflow.next(step1);

    workflowRepo.workflowLoad.returns({
      workflowId: 'workflow-123',
      serviceId: 'test-service',
      started: new Date(),
      current: 'step-1',
      initial: undefined,
      results: {},
    } as WorkflowState);

    // ACT
    await workflow.subscribe({});

    // ASSERT
    expect(workflowRepo.workflowInit.callCount).to.eq(1);
    expect(step1Fake.callCount).to.eq(1);
    expect(workflowRepo.workflowCompleted.callCount).to.eq(1);
  });

  // eslint-disable-next-line mocha/no-exclusive-tests
  it('should execute two step flow', async () => {
    // ARRANGE
    const step1Fake = sinon.fake.returns({ value: 'step1-result' });
    const step1: StepUnknown = {
      name: 'step-1',
      execute: step1Fake,
    } as StepUnknown;

    workflow.next(step1);

    const step2Fake = sinon.fake.returns({ value: 'step2-result' });
    const step2: StepUnknown = {
      name: 'step-2',
      execute: step2Fake,
    } as StepUnknown;

    workflow.next(step2);

    workflowRepo.workflowLoad.onFirstCall().returns({
      workflowId: 'workflow-123',
      serviceId: 'test-service',
      started: new Date(),
      current: 'step-1',
      initial: undefined,
      results: {},
    } as WorkflowState);

    workflowRepo.workflowLoad.onSecondCall().returns({
      workflowId: 'workflow-123',
      serviceId: 'test-service',
      started: new Date(),
      current: 'step-2',
      initial: undefined,
      results: {},
    } as WorkflowState);

    // ACT
    const workflowId = await workflow.subscribe({});

    await workflow.subscribe({ workflowId });

    // ASSERT
    expect(workflowRepo.workflowInit.callCount).to.eq(1);
    expect(step1Fake.callCount).to.eq(1);
    expect(workflowRepo.workflowCompleted.callCount).to.eq(1);
  });

  it('should execute rollback sequence on irretrievable step error', async () => {
    // TODO: Implement with example app
  });

  it('should detect out of order step execution', async () => {
    // TODO: Implement with example app
  });

  it('should detect step re-execution', async () => {
    // TODO: Implement with example app
  });
});
