import fs from 'fs';
import path from 'path';

class Loader {
  constructor(taskPath: string) {
    this.taskPath = taskPath;
    this.tasks = {};
  }

  load() {
    const taskPath = path.normalize(this.taskPath);
    fs.readdirSync(taskPath).filter((file) => {
      const hidden = file.indexOf('.') !== 0;
      const current = file !== 'index.js';
      return hidden && current;
    }).forEach((location) => {
      const file = path.resolve(taskPath, location);
      const task = require(file); // eslint-disable-line
      this.tasks[task.name] = task;
    });
  }
}

export default Loader;
