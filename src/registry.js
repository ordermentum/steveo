
import events from 'events';

import type { Task } from '../types';

class Registry {
  constructor() {
    this.registeredTasks = {};
    this.events = new events.EventEmitter();
  }

  addNewTask(task: Task) {
    this.events.emit('task_added', task);
    this.registeredTasks[task.topic] = task; // eslint-disable-line
  }

  removeTask(task: Task) {
    this.events.emit('task_removed', task);
    delete this.registeredTasks[task.topic]; // eslint-disable-line
  }

  getTopics = () => Object.keys(this.registeredTasks);

  getTask = (topic: string) => this.registeredTasks[topic];
}

export default Registry;
