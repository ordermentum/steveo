import genericPool, {Options, Pool} from 'generic-pool';
import { v4 } from 'uuid';
import Registry from '../runtime/registry';

export type Resource = {
  id: string;
};

declare global {
  var steveo: {
    pools: Pool<Resource>[]
  } | undefined;
}


export class ConsumerPool {
  registry: Registry;

  constructor(registry: Registry) {
    this.registry = registry;
  }

  async create(): Promise<Resource> {
    const resource = { id: v4() };
    this.registry.emit('pool_create', resource);
    return resource;
  }

  async destroy(resource: Resource) {
    this.registry.emit('pool_destroy', resource);
  }
}

export function build(registry: Registry, options: Options = {}) {
  const pool = genericPool.createPool<Resource>(new ConsumerPool(registry), options);
  /**
   * Steveo maintains a list of pools that need to be drained and cleared
   * Look at packages/steveo/src/lib/manager.ts for shutdown logic
   * This needs to be globally available for multiple steveo instances in a single process
   */
  if(!global.steveo?.pools)
    global.steveo = {
      pools: [pool]
    };
  else
    global.steveo.pools.push(pool);

  return pool;
}
