import sinon from 'sinon';
import { expect } from 'chai';
import { fixtures } from './fixtures/state_fixtures';
import { workflowFixture } from './fixtures/workflow_fixture';

// Workflow integration tests
describe('Workflow tests', () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sinon.restore();
  });

  it('should execute a simple one step flow', async () => {
    // ARRANGE
    const step1 = fixtures.stepReturn('step-1', 'step1-result');
    const { workflow, repository } = workflowFixture(sandbox);

    workflow.next(step1.step);

    // ACT
    await workflow.subscribe({});

    // ASSERT
    expect(step1.fake.callCount).to.eq(1);
    expect(repository.calls.init).to.eq(1);
    expect(repository.calls.completed).to.eq(1);
  });

  it('should execute two step flow', async () => {
    // ARRANGE
    const { workflow, repository } = workflowFixture(sandbox);
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
    expect(step2.fake.callCount).to.eq(1);
    expect(repository.calls.init).to.eq(1);
    expect(repository.calls.completed).to.eq(1);
    expect(repository.completed).to.eq(true);
  });

  it('should execute rollback sequence on irretrievable step error', async () => {
    // ARRANGE
    const { workflow, repository } = workflowFixture(sandbox);
    const step1 = fixtures.stepReturn('step-1', 'step1-result');
    const step2 = fixtures.stepThrow('step-2', 'Expected test error');

    workflow.next(step1.step);
    workflow.next(step2.step);

    // ACT
    const workflowId = await workflow.subscribe({});

    await workflow.subscribe({ workflowId });

    // ASSERT
    expect(step1.fake.callCount).to.eq(1);
    expect(repository.calls.init).to.eq(1);
    expect(repository.calls.load).to.eq(2);
    expect(repository.calls.completed).to.eq(0);
    expect(repository.calls.rollbacks).to.eq(2);
    expect(repository.calls.errors).to.eq(1);
  });

  it('should detect out of order step execution', async () => {
    // ARRANGE
    const { workflow, repository } = workflowFixture(sandbox);
    const step1 = fixtures.stepReturn('step-1', 'step1-result');

    workflow.next(step1.step);
    repository.overrideServiceId = 'mismatched-service-name';

    // ACT
    await workflow.subscribe({});

    // ASSERT
    expect(step1.fake.callCount).to.eq(0);
    expect(repository.calls.init).to.eq(1);
    expect(repository.calls.load).to.eq(1);
    expect(repository.calls.completed).to.eq(1);
    expect(repository.calls.rollbacks).to.eq(0);
    expect(repository.calls.errors).to.eq(1);
    expect(repository.completed).to.eq(true);
  });

  it('should detect step re-execution', async () => {
    // TODO: Implement with example app
  });
});
