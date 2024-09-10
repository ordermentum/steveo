import { WorkflowStateRepository } from "./workflow.repo";

export type TransactionHandle = {

  get type(): string;
};

/**
 *
 */
export interface Storage {

  /**
   *
   */
  get name(): string;

  /**
   *
   */
  transaction(fn: (tx: TransactionHandle) => Promise<void>): Promise<void>;

  /**
   * Factory to provide an instance of the concrete workflow state repository
   */
  workflow: WorkflowStateRepository;
}

/**
 * Factory specification all Steveo storage modules must support
 */
export type StorageFactory = {

  /**
   *
   */
  connect(): Storage;

  /**
   *
   */
  migrate(): void;
}


