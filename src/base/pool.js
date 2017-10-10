import genericPool from 'generic-pool';

class Factory {
  created: number;
  destroyed: number;
  bin: Array<Object>;

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

function build(factory = new Factory(), { max, min } = {}) {
  return genericPool.createPool(factory, {
    max,
    min,
  });
}

export {
  Factory,
  build,
};
