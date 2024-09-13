import { WorkflowStateRepository } from './workflow-repo';

export interface Repositories {
  workflow: WorkflowStateRepository;
}

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
  abstract transaction(
    fn: (repos: Repositories) => Promise<void>
  ): Promise<void>;
}
