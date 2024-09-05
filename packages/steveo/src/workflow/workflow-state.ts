
/**
 *
 */
export interface WorkflowState {

  /**
   * The unique key of the 
   */
  flowId: string;

  /**
   *
   */
  started: Date;

  /**
   *
   */
  step: number;

  /**
   *
   */
  failedStep?: number;

  /**
   *
   */
  failedErrMsg?: string;

  /**
   *
   */
  failedErrCallstack?: string;

  /**
   *
   */
  steps: Record<string, object>;
}
