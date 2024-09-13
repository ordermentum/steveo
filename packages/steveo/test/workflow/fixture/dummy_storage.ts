import { Repositories, Storage } from '../../../src/storage/storage';

export class DummyStorage extends Storage {
  constructor(private $repos: Repositories) {
    super('dummy-storage');
  }

  transaction(fn: (repos: Repositories) => Promise<void>): Promise<void> {
    return fn(this.$repos);
  }
}
