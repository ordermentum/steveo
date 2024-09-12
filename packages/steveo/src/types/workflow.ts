/**
 * Extra information that is to be included with each workflow
 * related message (either workflow or workflow step).
 */
export interface WorkflowPayload {
  workflowId?: string;
}

export interface WorkflowOptions {
  /**
   * Optional workflow topic name
   */
  topic?: string;
}
