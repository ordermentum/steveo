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

    await repo.createNewState(workflowId);

    const state = await repo.loadState(workflowId);

    expect(state?.workflowId).to.eq(workflowId);
    expect(state?.current).to.be.null;
    expect(state?.initial).to.be.null;
  });

  it('should record the start of a workflow execution', async () => {
    const workflowId = v4();

    await repo.createNewState(workflowId);

    await repo.startState({
      workflowId,
      current: 'step-1',
      initial: {
        test: 'abc',
        xyz: 123,
      },
    });

    const state = await repo.loadState(workflowId);

    expect(state?.current).to.eq('step-1');
    expect(state?.errors).to.be.null;

    const initial = state?.initial as { test: string; xyz: number };

    expect(initial.test).to.eq('abc');
    expect(initial.xyz).to.eq(123);
  });

  it('should update the current step', async () => {
    const workflowId = v4();

    await repo.createNewState(workflowId);

    await repo.startState({
      workflowId,
      current: 'step-1',
      initial: undefined,
    });

    await repo.loadState(workflowId);

    await repo.updateCurrentStep(workflowId, 'step-2');

    const state = await repo.loadState(workflowId);

    expect(state?.current).to.eq('step-2');
  });

  it('should record multiple errors against a state', async () => {
    const workflowId = v4();

    await repo.createNewState(workflowId);

    await repo.recordError(workflowId, 'error-key-1', 'error 1 content');
    await repo.recordError(workflowId, 'error-key-2', 'error 2 content');

    const state = await repo.loadState(workflowId);

    expect(state?.errors?.length).to.eq(2);
    expect(state?.errors?.[0].identifier).to.eq('error-key-1');
    expect(state?.errors?.[0].error).to.eq('error 1 content');
    expect(state?.errors?.[1].identifier).to.eq('error-key-2');
    expect(state?.errors?.[1].error).to.eq('error 2 content');
  });

  it('should record a step result', async () => {
    const workflowId = v4();
    type Result = { value: number };

    await repo.createNewState(workflowId);
    await repo.recordStepResult(workflowId, 'step1', { value: 111 });
    await repo.recordStepResult(workflowId, 'step2', { value: 999 });

    const state = await repo.loadState(workflowId);

    expect((state?.results.step1 as Result).value).to.eq(111);
    expect((state?.results.step2 as Result).value).to.eq(999);
  });
});
