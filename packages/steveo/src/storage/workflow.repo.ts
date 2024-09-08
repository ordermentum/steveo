import { WorkflowState } from "../types/workflow-state";

// TODO: Implement workflow state repository
export class WorkflowStateRepository {
  loadState(_flowId: string): Promise<WorkflowState> {
    return Promise.resolve({} as WorkflowState);
  }
  saveState(_flowId: string, _state: unknown): Promise<WorkflowState> {
    return Promise.resolve({} as WorkflowState);
  }
}



