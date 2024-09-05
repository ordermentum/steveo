import { randomUUID } from "crypto";
import { Step } from "./workflow-step";
import { WorkflowState } from "./workflow-state";


class Workflow {

  /**
   * The execution step definitions.
   * Uses an object type as the generic types of the steps
   * will vary from step to step.
   */
  steps: object[] = [];


  constructor(private flowName: string) {}

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
    const state = await this.loadState(flowId);

    if (state.failedStep) {
      this.rollback(state);
    }


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
  private async failedStep(error: Error) {

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
      flowId: `${this.flowName}-${randomUUID()}`,
      started: new Date(),
      steps: {},
    };
  }

  /**
   *
   */
  private async rollback(state: WorkflowState) {

    
    // this.previous.rollback();
  }
}

/**
 * Creates a new flow instance to be initialised.
 * The flow name is used for diagnostic purposes
 */
export function flow(flowName: string) {
  return new Workflow(flowName);
}

