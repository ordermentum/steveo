import glob from 'glob';
import path from 'path';

class Loader {
  constructor(instance: Object, root: string, pattern: string) {
    this.pattern = pattern;
    this.root = root;
    this.instance = instance;
  }

  load() {
    glob.sync(this.pattern).forEach((location) => {
      const handler = require(path.join(this.root, location)); // eslint-disable-line
      this.instance.registry.addNewTask({ task: handler.taskName, subscribe: handler });
    });
  }
}

export default Loader;
