import assert from 'node:assert';
import { WorkflowState } from '../../../src/runtime/workflow-state';
import { WorkflowStateRepository } from '../../../src/storage/workflow-repo';

/**
 *
 */
export class MemoryStateRepository implements WorkflowStateRepository {
  public state: WorkflowState | undefined;

  public completed = false;

  public calls = {
    init: 0,
    load: 0,
    started: 0,
    completed: 0,
    pointerUpdate: 0,
    rollbacks: 0,
    errors: 0,
    storeResult: 0,
  };

  workflowInit(props: {
    workflowId: string;
    serviceId: string;
    current: string;
    initial: unknown;
  }): Promise<void> {
    this.state = {
      workflowId: props.workflowId,
      serviceId: props.serviceId,
      started: new Date(),
      current: props.current,
      initial: props.initial,
      results: {},
    };
    this.calls.init += 1;

    return Promise.resolve();
  }

  loadWorkflow(workflowId: string): Promise<WorkflowState | undefined> {
    this.calls.load += 1;

    return Promise.resolve(
      this.state?.workflowId === workflowId ? this.state : undefined
    );
  }

  updateWorkflowStarted(start: {
    workflowId: string;
    current: string;
    initial: unknown;
  }): Promise<void> {
    this.calls.started += 1;

    if (!this.state) {
      this.state = { ...start, serviceId: 'test-service', started: new Date() };
    } else {
      this.state.workflowId = start.workflowId;
      this.state.current = start.current;
      this.state.initial = start.initial;
    }

    return Promise.resolve();
  }

  updateWorkflowCompleted(workflowId: string): Promise<void> {
    assert(this.state);
    assert(this.state.workflowId === workflowId);

    this.calls.completed += 1;
    this.completed = true;

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
