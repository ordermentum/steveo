import assert from 'node:assert';
import { WorkflowState } from '../../../src/types/workflow-state';
import { WorkflowStateRepository } from '../../../src/types/workflow-repo';

/**
 *
 */
export class MemoryStateRepository implements WorkflowStateRepository {
  public state: WorkflowState | undefined;

  public completed = false;

  public overrideServiceId: string | undefined;

  public calls = {
    init: 0,
    load: 0,
    completed: 0,
    delete: 0,
    pointerUpdate: 0,
    rollbacks: 0,
    errors: 0,
    storeResult: 0,
  };

  reset() {
    this.state = undefined;
    this.completed = false;
    this.calls = {
      init: 0,
      load: 0,
      completed: 0,
      delete: 0,
      pointerUpdate: 0,
      rollbacks: 0,
      errors: 0,
      storeResult: 0,
    };
  }

  workflowInit(props: {
    workflowId: string;
    serviceId: string;
    current: string;
    initial: unknown;
  }): Promise<void> {
    this.calls.init += 1;
    this.state = {
      ...props,
      serviceId: this.overrideServiceId ?? 'test-service',
      started: new Date(),
      results: {},
    };

    return Promise.resolve();
  }

  loadWorkflow(workflowId: string): Promise<WorkflowState | undefined> {
    this.calls.load += 1;

    return Promise.resolve(
      this.state?.workflowId === workflowId ? this.state : undefined
    );
  }

  updateWorkflowCompleted(workflowId: string): Promise<void> {
    assert(this.state);
    assert(this.state.workflowId === workflowId);

    this.calls.completed += 1;
    this.completed = true;

    return Promise.resolve();
  }

  deleteWorkflow(_workflowId: string): Promise<void> {
    this.state = undefined;
    this.calls.delete += 1;

    return Promise.resolve();
  }

  updateCurrentStep(workflowId: string, stepName: string): Promise<void> {
    assert(this.state);
    assert(this.state.workflowId === workflowId);

    this.calls.pointerUpdate += 1;
    this.state.current = stepName;

    return Promise.resolve();
  }

  storeExecuteError(
    workflowId: string,
    identifier: string,
    error: unknown
  ): Promise<void> {
    assert(this.state);
    assert(this.state.workflowId === workflowId);

    if (!this.state.errors) {
      this.state.errors = [];
    }

    this.calls.errors += 1;
    this.state.errors.push({ identifier, error });

    return Promise.resolve();
  }

  storeStepResult(
    workflowId: string,
    stepId: string,
    result: unknown
  ): Promise<void> {
    assert(this.state);
    assert(this.state.results);
    assert(this.state.workflowId === workflowId);

    this.calls.storeResult += 1;
    this.state.results[stepId] = result;

    return Promise.resolve();
  }

  rollbackStepExecute(workflowId: string, nextStep: string): Promise<void> {
    assert(this.state);
    assert(this.state.results);
    assert(this.state.workflowId === workflowId);

    this.calls.rollbacks += 1;
    this.state.current = nextStep;

    return Promise.resolve();
  }
}
