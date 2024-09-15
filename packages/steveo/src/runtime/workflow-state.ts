/**
 * Tracks the state of a workflow execution.
 */
export interface WorkflowState {
  /**
   * The unique key of the workflow execution instance.
   */
  workflowId: string;

  /**
   * Source service the workflow is executing on e.g. Ordermentum or Payments.
   * Workflows cannot execute across machine boundaries (such a change would)
   * require a centralised repository for workflow state
   */
  serviceId: string;

  /**
   * The time the flow execution began.
   * Diagnostics and auditing.
   */
  started: Date;

  /**
   * The time the flow completed
   */
  completed?: Date;

  /**
   * The current step being executed in this flow.
   * This will be the human readable step identifier.
   */
  current: string;

  /**
   * The initial value that started the flow execution.
   * The engine will pass this value to the first step.
   */
  initial: unknown;

  /**
   * Step state tracking.
   * The next step in the chain will be executed with the result
   * of the previous step as its argument.
   */
  results: Record<string, unknown>;

  /**
   * Diagnostic and auditing tracking of errors that occurred
   */
  errors?: {
    /**
     * Identifier of where the error occurred, which may be in the flow of step
     * executions or while rolling back. The identifier is purposely ambiguous
     * to allow for maximum flexbility in error capturing
     */
    identifier: string;

    /**
     * General representation of a string serialised node Error object.
     */
    error: unknown;
  }[];
}
