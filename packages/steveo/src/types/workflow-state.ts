
// TODO: Write Prisma persistence

/**
 * Tracks the state of a workflow execution.
 */
export interface WorkflowState {

  /**
   * The unique key of the workflow execution instance.
   */
  flowId: string;

  /**
   * The time the flow execution began.
   * Diagnostics and auditing.
   */
  started: Date;

  /**
   * The current step being executed in this flow.
   * Will increment under "happy path" flow where we are advancing through
   * the steps, or decrementing if the flow has failed and rolling back.
   */
  current: number;

  /**
   * The initial value that started the flow execution.
   * The engine will pass this value to the first step.
   */
  initial: object;

  /**
   * Step state tracking.
   * The next step in the chain will be executed with the result
   * of the previous step as its argument.
   */
  results: object[];

  /**
   * Diagnostic and auditing tracking of the step a flow execution failed
   */
  failedStep?: number;

  /**
   * Diagnostic and auditing tracking of the failed error message
   */
  failedErrMsg?: string;

  /**
   * Diagnostic and auditing tracking of the failed error callstack
   */
  failedErrStack?: string;
}
