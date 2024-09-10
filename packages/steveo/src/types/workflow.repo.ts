import { WorkflowState } from "../types/workflow-state";

export interface WorkflowStateRepository {

  loadState(flowId: string): Promise<WorkflowState>;

  saveState(flowId: string, state: unknown): Promise<WorkflowState>;
}



