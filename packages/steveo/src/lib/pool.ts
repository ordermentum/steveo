import genericPool, { Options } from 'generic-pool';
import { v4 } from 'uuid';
import Registry from '../registry';

export type Resource = {
  id: string;
};

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
  return genericPool.createPool<Resource>(new ConsumerPool(registry), options);
}
