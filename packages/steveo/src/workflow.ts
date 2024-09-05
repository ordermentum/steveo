import { v4 } from 'uuid';
import { Step } from "./types/workflow-step";
import { WorkflowState } from "./types/workflow-state";
import assert from 'node:assert';
import { TaskOptions } from './common';


// TODO: Implement workflow state repository
class WorkflowStateRepository {

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

  /**
   * The execution step definitions.
   * Uses an object type as the generic types of the steps
   * will vary from step to step.
   */
  steps: object[] = [];

  // TODO: Change over to concrete implementations when done
  stateRepo = new WorkflowStateRepository();
  db = new Database();

  constructor(
    private _name: string,
    private _topic: string,
    private _options?: TaskOptions,
  ) {
    assert(_name, `flowId must be specified`);
  }

  // Support the existing interface ITask with duck typing
  get name() { return this._name; }
  get topic() { return this._topic; }
  get options() { return this._options; }

  /**
   *
   */
  next<State, Result>(step: Step<State, Result>): Workflow {
    this.steps.push(step);

    return this;
  }

  /**
   *
   */
  async subscribe<T extends { workflowId: string }>(payload: T) {
    assert(this.steps?.length, `Steps must be defined before a flow is executed ${this._name}`);
    assert(payload.workflowId, `flowId cannot be empty`);

    const state = await this.loadState(payload.workflowId);

    assert(state.current < 0, `Workflow ${payload.workflowId} step ${state.current} cannot be less than zero`);
    assert(state.current < state.results.length, `Workflow ${payload.workflowId} step ${state.current} exceeds available steps ${state.results.length}`);

    const stateStep = state.results[state.current];

    if (state.failedStep) {
      this.rollback(state);
    }

    // TODO: Protect out of order excution or step re-execution

    this.forward(stateStep);
  }

  /**
   * Executes the steps from the given step using the
   * provided state & context moving forward. This is the
   * "happy path" of workflow execution
   */
  private async forward(state: object) {
    const transaction = this.db.transaction();

    try {
      const result = await step.exec(stepState);

      // TODO: Update state

      this.state[this.add.name] = result;

      transaction.commit();

      // db.saveState(flowId, state);

      // return result;
    }
    catch (err) {
      this.failedStep(state, err);
    }
  }

  /**
   *
   */
  private async failedStep(state: WorkflowState, error: Error) {

    state.failedStep = state.current;
    state.failedErrMsg = error.message;
    state.failedErrStack = error.stack;

    // TODO: Update database

    // TODO: Start rollback execution

    // TODO: Catch errors in rollback execution

  }

  /**
   *
   * @param flowId
   * @returns
   */
  private async loadState(flowId: string): Promise<WorkflowState> {
    const state = await this.db.loadState<WorkflowState>(flowId);

    if (state) {
      return state;
    }

    return {
      current: 0,
      flowId: `${this._name}-${v4()}`,
      started: new Date(),
      results: {},
    };
  }

  /**
   *
   */
  private async rollback(state: WorkflowState) {


    // this.previous.rollback();
  }
}


