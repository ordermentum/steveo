import { WorkflowStateRepository } from './workflow-repo';

/**
 * The abstract notion of storage that provides us with the bare
 * minimum needed from a persistence perspective. The implementation
 * details will be unique to the storage providers.
 */
export abstract class Storage {
  constructor(private $name: string) {}

  /**
   * Debug information only
   */
  get name() {
    return this.$name;
  }

  /**
   * Storage providers will implement this with their specific transaction
   * implementation handling
   */
  abstract transaction(fn: () => Promise<void>): Promise<void>;

  /**
   * Factory to provide an instance of the concrete workflow state repository
   */
  abstract workflow: WorkflowStateRepository;
}
