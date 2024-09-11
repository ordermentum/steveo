import { WorkflowState } from '../runtime/workflow-state';

/**
 * Repository contract for workflow state persistence.
 * See `storage.postgres` for an implementation example.
 */
export interface WorkflowStateRepository {
  /**
   * Given a workflow ID, load the current state from storage
   */
  loadState(workflowId: string): Promise<WorkflowState | undefined>;

  /**
   * Update the given workflow ID current step name
   */
  updateCurrentStep(workflowId: string, stepName: string): Promise<void>;

  /**
   * Create a brand new workflow state given the identifier.
   * The ID must be unique.
   */
  createNewState(workflowId: string): Promise<void>;

  /**
   *
   */
  startState(start: {
    workflowId: string;
    current: string;
    initial: unknown;
  }): Promise<void>;

  /**
   * Record an error against the current workflow.
   * This may record any number of errors and as such is flexible around
   * the identifier that is provided.
   */
  recordError(
    workflowId: string,
    identifier: string,
    error: unknown
  ): Promise<void>;

  /**
   * Record a workflow step execution result. Only one result
   * may be stored per step.
   */
  recordStepResult(
    workflowId: string,
    stepId: string,
    result: unknown
  ): Promise<void>;
}
