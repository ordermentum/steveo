import { v4 } from 'uuid';
import { Step, StepUnknown } from "./types/workflow-step";
import { WorkflowState } from "./types/workflow-state";
import assert from 'node:assert';
import { Logger, TaskOptions } from './common';
import nullLogger from 'null-logger';
import { Steveo } from '.';


// TODO: Implement workflow state repository
class WorkflowStateRepository {
  loadState(_flowId: string): Promise<WorkflowState> {
    return Promise.resolve({} as WorkflowState);
  }
  saveState(_flowId: string, _state: unknown): Promise<WorkflowState> {
    return Promise.resolve({} as WorkflowState);
  }
}

// TODO: Add abstracted database for other
class Database {
  transaction() {
    return {
      commit() {}
    }
  }

}

export class Workflow {

  logger: Logger;

  /**
   * The execution step definitions.
   * Uses an object type as the generic types of the steps
   * will vary from step to step.
   */
  steps: Step<unknown, unknown>[] = [];

  // TODO: Change over to concrete implementations when done
  stateRepo = new WorkflowStateRepository();
  db = new Database();

  constructor(
    steveo: Steveo,
    private _name: string,
    private _topic: string,
    private _options?: TaskOptions,
  ) {
    assert(_name, `flowId must be specified`);

    this.logger = steveo?.logger ?? nullLogger;
  }

  // Support the existing interface ITask with duck typing
  get name() { return this._name; }
  get topic() { return this._topic; }
  get options() { return this._options; }

  /**
   *
   */
  next<State, Result>(step: Step<State, Result>): Workflow {
    this.steps.push(step as Step<unknown, unknown>);

    return this;
  }

  /**
   *
   */
  async subscribe<T extends { workflowId: string }>(payload: T) {
    assert(this.steps?.length, `Steps must be defined before a flow is executed ${this._name}`);
    assert(payload.workflowId, `workflowId cannot be empty`);

    const flowState = await this.loadState(payload.workflowId, payload);

    assert(flowState.current < 0, `Workflow ${payload.workflowId} step ${flowState.current} cannot be less than zero`);
    assert(flowState.current < flowState.results.length, `Workflow ${payload.workflowId} step ${flowState.current} exceeds available steps ${flowState.results.length}`);

    const stepState = flowState.results[flowState.current];

    // If this state has failed then we pass control over to the
    // rollback executor.
    if (flowState.failedStep) {
      this.rollback(flowState);
    }

    // TODO: Protect out of order excution or step re-execution

    const step = this.steps[flowState.current];

    // TODO: Further step validation

    this.forward(step, stepState, flowState);
  }

  /**
   * Executes the steps from the given step using the
   * provided state & context moving forward. This is the
   * "happy path" of workflow execution
   */
  private async forward(step: StepUnknown, stepState: unknown, flowState: WorkflowState) {
    const transaction = this.db.transaction();

    try {
      const result = await step.exec(stepState);

      // TODO: Update state

      flowState.results[flowState.current] = result;
      flowState.current++;

      this.stateRepo.saveState(flowState.flowId, flowState);

      transaction.commit();

      return result;
    }
    catch (error) {
      const isError = error instanceof Error;

      flowState.failedStep = flowState.current;
      flowState.failedErrMsg = isError ? error.message : `Unknown error: ${error?.toString()}`;
      flowState.failedErrStack = isError ? error.stack : undefined;

      // TODO: Update database

      // TODO: Start rollback execution

      // TODO: Catch errors in rollback execution

      throw error;
    }
  }

  /**
   *
   * @param flowId
   * @returns
   */
  private async loadState(flowId: string, initial: unknown): Promise<WorkflowState> {
    const state = await this.stateRepo.loadState(flowId);

    if (state) {
      return state;
    }

    return {
      initial,
      current: 0,
      flowId: `${this._name}-${v4()}`,
      started: new Date(),
      results: [],
    };
  }

  /**
   *
   */
  private async rollback(flowState: WorkflowState) {

    try {

      flowState.current--;

    }
    catch (error) {

    }
  }
}


