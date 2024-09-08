
/**
 *
 */
export interface Step<StepState, StepResult> {

  /**
   * The steveo task name that will kick off this
   * step. As the step is part of a workflow, this will
   * be intercepted and executed as a part of the
   * workflow middleware.
   *
   * Execution state storage will use this name in conjunction
   * with a unique random id to allow for multiple uses
   * of the same step within a single workflow run.
   */
  trigger: string;

  /**
   * Execute the step's implementation
   */
  execute: (state: StepState) => StepResult | Promise<StepResult>;

  /**
   *
   */
  rollback?: (state: StepState) => void;
}

export type StepUnknown = Step<unknown, unknown>;


