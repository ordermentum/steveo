import { TaskOptions } from './task-options';

/**
 * Extra information that is to be included with each workflow
 * related message (either workflow or workflow step).
 */
export interface WorkflowPayload {
  workflowId: string | undefined;
}

/**
 *
 */
export interface WorkflowOptions extends TaskOptions {
  /**
   * Debug ID for this service
   * Will be used to detect cross service workflow message processing too.
   */
  serviceId: string;

  /**
   * If true the engine will delete the workflow from storage.
   * This is used in production systems as workflow states are considered
   * transient, whereas developers may disable this for development and
   * diagnostics.
   */
  deleteOnComplete: boolean;
}
