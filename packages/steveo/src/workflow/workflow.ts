import { v4 } from 'uuid';
import { Step } from "./workflow-step";
import { WorkflowState } from "./workflow-state";
import { get, last, select } from 'radash';
import assert from 'node:assert';


export class Workflow {

  /**
   * The execution step definitions.
   * Uses an object type as the generic types of the steps
   * will vary from step to step.
   */
  steps: object[] = [];


  constructor(private flowName: string) {
    assert(flowName, `flowId must be specified`);
  }

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
  async exec(flowId: string) {
    assert(this.steps?.length, `Steps must be defined before a flow is executed ${this.flowName}`);
    assert(flowId, `flowId cannot be empty`);

    const state = await this.loadState(flowId);

    assert(state.current < 0, `Workflow ${flowId} step ${state.current} cannot be less than zero`);
    assert(state.current < state.results.length, `Workflow ${flowId} step ${state.current} exceeds available steps ${state.results.length}`);

    const step = state.results.length[state.current];

    if (state.failedStep) {
      this.rollback(state);
    }

    // TODO: Protect out of order excution or step re-execution





    this.forward()
  }

  /**
   * Executes the steps from the given step using the
   * provided state & context moving forward. This is the
   * "happy path" of workflow execution
   */
  private async forward() {
    const transaction = db.transaction();

    try {
      const result = await step.exec(stepState);

      // // TODO: Think more about this, needs to hold step state and mark step status so execution can resume
      // state[this.add.name] = result;

      // transaction.commit();

      // db.saveState(flowId, state);

      // return result;
    }
    catch (err) {
      ;
    }
  }

  /**
   *
   */
  private async failedStep(state: WorkflowState, error: Error) {

    state.failedStep = state.current;
    state.failedErrMsg = error.message;
    state.failedErrStack = error.stack;


    // update state with error

    // start rollback execution

    // catch errors in rollback execution

  }

  /**
   *
   * @param flowId
   * @returns
   */
  private async loadState(flowId: string): Promise<WorkflowState> {
    const state = await db.loadState<WorkflowState>(flowId);

    if (state) {
      return state;
    }

    return {
      current: 0,
      flowId: `${this.flowName}-${v4()}`,
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


