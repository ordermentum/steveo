import { WorkflowState, WorkflowStateRepository } from 'steveo-steveo';

/**
 *
 */
export class WorkflowStateRepositoryPostgres
  implements WorkflowStateRepository
{
  /**
   *
   */
  loadState(_workflowId: string): Promise<WorkflowState | undefined> {
    throw new Error('Method not implemented.');
  }

  /**
   *
   */
  updateCurrentStep(_workflowId: string, _stepName: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   *
   */
  createNewState(_workflowId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   *
   */
  recordError(
    _workflowId: string,
    _identifier: string,
    _error: string
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   *
   */
  recordStepResult(
    _workflowId: string,
    _stepId: string,
    _result: unknown
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
