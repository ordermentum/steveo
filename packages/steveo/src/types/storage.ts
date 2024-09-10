import { WorkflowStateRepository } from "./workflow.repo";

/**
 *
 */
export interface Transaction {

  /**
   *
   */
  commit(): Promise<void>;

  /**
   *
   */
  rollback(): Promise<void>;
}

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
  transaction(): Promise<Transaction>;

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


