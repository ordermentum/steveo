import { WorkflowState } from '../runtime/workflow-state';

/**
 * Repository contract for workflow state persistence.
 * See `storage.postgres` for an implementation example.
 */
export interface WorkflowStateRepository {
  /**
   * Create a brand new workflow state given the identifier.
   * The ID must be unique.
   */
  workflowInit(
    workflowId: string,
    serviceId: string,
    current: string
  ): Promise<void>;

  /**
   * Given a workflow ID, load the current state from storage
   */
  workflowLoad(workflowId: string): Promise<WorkflowState | undefined>;

  /**
   * Mark that the given workflow has started execution
   */
  workflowStarted(start: {
    workflowId: string;
    current: string;
    initial: unknown;
  }): Promise<void>;

  /**
   * Mark the given workflow completed
   */
  workflowCompleted(workflowId: string): Promise<void>;

  /**
   * Update the given workflow ID current step name
   */
  stepPointerUpdate(workflowId: string, stepName: string): Promise<void>;

  /**
   * Record an error against the current workflow.
   * This may record any number of errors and as such is flexible around
   * the identifier that is provided.
   */
  stepExecuteError(
    workflowId: string,
    identifier: string,
    error: unknown
  ): Promise<void>;

  /**
   * Record a workflow step execution result. Only one result
   * may be stored per step.
   */
  stepExecuteResult(
    workflowId: string,
    stepId: string,
    result: unknown
  ): Promise<void>;

  /**
   *
   */
  rollbackStepExecute(workflowId: string, nextStep: string): Promise<void>;
}
