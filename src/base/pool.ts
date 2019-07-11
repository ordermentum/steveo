import genericPool from 'generic-pool';

class Factory {
  created: number;

  destroyed: number;

  bin: any[];

  constructor() {
    this.created = 0;
    this.destroyed = 0;
    this.bin = [];
  }

  async create() {
    this.created += 1;
    const resource = {
      id: this.created,
    };
    return resource;
  }

  async destroy(resource) {
    this.destroyed += 1;
    this.bin.push(resource);
    return true;
  }
}

function build(options = {}, factory = new Factory()) {
  return genericPool.createPool(factory, options);
}

export { Factory, build };
