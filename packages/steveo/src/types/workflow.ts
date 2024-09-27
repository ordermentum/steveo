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
   *
   */
  serviceId: string;
}
