import { WorkflowState } from './workflow-state';

/**
 * Repository contract for workflow state persistence.
 * See `storage.postgres` for an implementation example.
 */
export interface WorkflowStateRepository {
  /**
   * Create a brand new workflow state given the identifier.
   * The ID must be unique.
   */
  workflowInit(props: {
    workflowId: string;
    serviceId: string;
    current: string;
    initial: unknown;
  }): Promise<void>;

  /**
   * Given a workflow ID, load the current state from storage
   */
  loadWorkflow(workflowId: string): Promise<WorkflowState | undefined>;

  /**
   * Mark the given workflow completed
   */
  updateWorkflowCompleted(workflowId: string): Promise<void>;

  /**
   * Delete a workflow from storage
   * This is generally done when a workflow completes
   */
  deleteWorkflow(workflowId: string): Promise<void>;

  /**
   * Update the given workflow ID current step name
   */
  updateCurrentStep(workflowId: string, stepName: string): Promise<void>;

  /**
   * Record an error against the current workflow.
   * This may record any number of errors and as such is flexible around
   * the identifier that is provided.
   */
  storeExecuteError(
    workflowId: string,
    identifier: string,
    error: unknown
  ): Promise<void>;

  /**
   * Record a workflow step execution result. Only one result
   * may be stored per step.
   */
  storeStepResult(
    workflowId: string,
    stepId: string,
    result: unknown
  ): Promise<void>;

  /**
   *
   */
  rollbackStepExecute(workflowId: string, nextStep: string): Promise<void>;
}
