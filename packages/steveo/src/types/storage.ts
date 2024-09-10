import { WorkflowStateRepository } from "./workflow.repo";

/**
 * This is a base transaction handle type used to create a common
 * abstract type for transaction handling. When implementing a
 * storage provider module the module will extend this type to
 * add it's driver specific information for managing a transaction.
 */
export type TransactionHandle = {

  /**
   * Debugging information from the concrete provider only, no runtime usage
   */
  get type(): string;
};

/**
 * The abstract notion of storage that provides us with the bare
 * minimum needed from a persistence perspective. The implementation
 * details will be unique to the storage providers.
 */
export abstract class Storage {

  constructor(
    private _name: string
  ) {}

  /**
   * Debug information only
   */
  get name() { return this._name; }

  /**
   * Storage providers will implement this with their specific transaction
   * implementation handling
   */
  abstract transaction(fn: (tx: TransactionHandle) => Promise<void>): Promise<void>;

  /**
   * Factory to provide an instance of the concrete workflow state repository
   */
  abstract workflow: WorkflowStateRepository;
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


