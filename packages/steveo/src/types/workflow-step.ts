
/**
 * Type definition for a single workflow step that defines
 * what the engine is to execute to complete the task, or
 * (optionally), what to execute if the step fails irretrievably.
 */
export interface Step<StepState, StepResult> {

  /**
   * The steveo workflow step name that will kick off this
   * step. As the step is part of a workflow, this will
   * be intercepted and executed as a part of the
   * workflow execution engine.
   */
  trigger: string;

  /**
   * Execute the step's implementation
   */
  execute: (state: StepState) => StepResult | Promise<StepResult>;

  /**
   *
   */
  rollback?: (state: StepState) => void | Promise<void>;
}

export type StepUnknown = Step<unknown, unknown>;


