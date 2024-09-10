import { WorkflowState, WorkflowStateRepository } from 'steveo-steveo';

/**
 *
 */
export class WorkflowStateRepositoryPostgres implements WorkflowStateRepository {

  /**
   *
   * @param flowId
   * @returns
   */
  loadState(_flowId: string): Promise<WorkflowState> {
    return Promise.resolve({} as WorkflowState);
  }

  /**
   *
   * @param flowId
   * @param state
   * @returns
   */
  saveState(_flowId: string, _state: unknown): Promise<WorkflowState> {
    return Promise.resolve({} as WorkflowState);
  }
}



