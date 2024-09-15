import { PrismaClient } from '@prisma/client';
import { v4 } from 'uuid';
import { expect } from 'chai';
import { WorkflowStateRepositoryPostgres } from '../src/repo/workflow-postgres-repo';

describe('Workflow state postgres repo', () => {
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DATASOURCE_URL,
  });
  const repo = new WorkflowStateRepositoryPostgres(prisma);

  it('should create new state and load it', async () => {
    const workflowId = v4();

    await repo.workflowInit(workflowId, 'test-service', 'step1');

    const state = await repo.workflowLoad(workflowId);

    expect(state?.workflowId).to.eq(workflowId);
    expect(state?.current).to.be.null;
    expect(state?.initial).to.be.null;
  });

  it('should record the start of a workflow execution', async () => {
    const workflowId = v4();

    await repo.workflowInit(workflowId, 'test-service', 'step1');

    await repo.workflowStarted({
      workflowId,
      current: 'step-1',
      initial: {
        test: 'abc',
        xyz: 123,
      },
    });

    const state = await repo.workflowLoad(workflowId);

    expect(state?.current).to.eq('step-1');
    expect(state?.errors).to.be.null;

    const initial = state?.initial as { test: string; xyz: number };

    expect(initial.test).to.eq('abc');
    expect(initial.xyz).to.eq(123);
  });

  it('should update the current step', async () => {
    const workflowId = v4();

    await repo.workflowInit(workflowId, 'test-service', 'step1');

    await repo.workflowStarted({
      workflowId,
      current: 'step-1',
      initial: undefined,
    });

    await repo.workflowLoad(workflowId);

    await repo.stepPointerUpdate(workflowId, 'step-2');

    const state = await repo.workflowLoad(workflowId);

    expect(state?.current).to.eq('step-2');
  });

  it('should record multiple errors against a state', async () => {
    const workflowId = v4();

    await repo.workflowInit(workflowId, 'test-service', 'step1');

    await repo.stepExecuteError(workflowId, 'error-key-1', 'error 1 content');
    await repo.stepExecuteError(workflowId, 'error-key-2', 'error 2 content');

    const state = await repo.workflowLoad(workflowId);

    expect(state?.errors?.length).to.eq(2);
    expect(state?.errors?.[0].identifier).to.eq('error-key-1');
    expect(state?.errors?.[0].error).to.eq('error 1 content');
    expect(state?.errors?.[1].identifier).to.eq('error-key-2');
    expect(state?.errors?.[1].error).to.eq('error 2 content');
  });

  it('should record a step result', async () => {
    const workflowId = v4();
    type Result = { value: number };

    await repo.workflowInit(workflowId, 'test-service', 'step1');
    await repo.stepExecuteResult(workflowId, 'step1', { value: 111 });
    await repo.stepExecuteResult(workflowId, 'step2', { value: 999 });

    const state = await repo.workflowLoad(workflowId);

    expect((state?.results.step1 as Result).value).to.eq(111);
    expect((state?.results.step2 as Result).value).to.eq(999);
  });

  it('should record flow completion', async () => {
    const workflowId = v4();

    await repo.workflowInit(workflowId, 'test-service', 'step1');
    await repo.workflowCompleted(workflowId);

    const state = await repo.workflowLoad(workflowId);

    expect(state?.current).to.be.null;
    expect(state?.completed).not.to.be.null;
  });

  it('should record rollback step', async () => {
    const workflowId = v4();

    await repo.workflowInit(workflowId, 'test-service', 'step1');

    await repo.stepExecuteResult(workflowId, 'step1', { value: 111 });
    await repo.stepExecuteResult(workflowId, 'step2', { value: 999 });

    await repo.workflowStarted({
      workflowId,
      current: 'step1',
      initial: { test: 123 },
    });

    await repo.stepExecuteResult(workflowId, 'step2', { xyz: 'test' });

    const startState = await repo.workflowLoad(workflowId);

    expect(startState?.current).to.eq('step2');

    // Rollback to the previous step
    await repo.rollbackStepExecute(workflowId, 'step1');

    const finalState = await repo.workflowLoad(workflowId);

    expect(finalState?.current).to.eq('step1');

    const state = await repo.workflowLoad(workflowId);

    expect(state?.current).to.eq('step1');
    expect(state?.completed).to.be.null;
  });
});
