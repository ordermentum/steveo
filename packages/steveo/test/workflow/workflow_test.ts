import sinon from 'sinon';
import { fromStub, stubInterface } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { Workflow } from '../../src/runtime/workflow';
import { Repositories, Storage } from '../../src/storage/storage';
import { IProducer, IRegistry } from '../../src/common';
import { StepUnknown } from '../../src/runtime/workflow-step';
import { WorkflowStateRepository } from '../../src/storage/workflow-repo';

// Workflow integration tests
describe('Workflow tests', () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sinon.reset();
  });

  it('should execute a simple one step flow', async () => {
    // ARRANGE
    const workflowRepo = stubInterface<WorkflowStateRepository>(sandbox);
    const repos: Repositories = {
      workflow: fromStub(workflowRepo),
    };
    const storage = stubInterface<Storage>(sandbox, {
      transaction: (
        fn: (repos: Repositories) => Promise<void>
      ): Promise<void> => fn(fromStub(repos)),
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
    });

    sinon.fake(storage.transaction);

    const fake = sinon.fake();
    const step: StepUnknown = {
      name: 'step-1',
      execute: fake,
    };

    workflow.next(step);

    // ACT
    workflow.subscribe({});

    // ASSERT
    expect(workflowRepo.workflowInit.callCount).to.eq(1);
    // expect(fake.callCount).to.eq(1);

    // ASSERT: Initialise workflow execution
    // ASSERT: Workflow ran to completion
  });

  it('should execute two step flow', async () => {
    //
  });

  it('should execute rollback sequence on irretrievable step error', async () => {
    //
  });

  it('should detect out of order step execution', async () => {
    //
  });

  it('should detect step re-execution', async () => {
    //
  });
});
