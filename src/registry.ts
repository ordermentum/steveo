import events from 'events';

import { IRegistry, IEvent, Task } from '../types';

class Registry implements IRegistry {
  registeredTasks: Object;

  events: IEvent;

  constructor() {
    this.registeredTasks = {};
    this.events = new events.EventEmitter();
  }

  addNewTask(task: Task) {
    this.events.emit('task_added', task);
    this.registeredTasks[task.topic] = task;
  }

  removeTask(task: Task) {
    this.events.emit('task_removed', task);
    delete this.registeredTasks[task.topic];
  }

  getTopics(): Array<string> {
    return Object.keys(this.registeredTasks);
  }

  getTask(topic: string): Task {
    return this.registeredTasks[topic];
  }
}

export default Registry;
