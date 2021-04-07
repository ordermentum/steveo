import events from 'events';

import { IRegistry, IEvent, ITask, TaskList } from './common';

class Registry implements IRegistry {
  registeredTasks: TaskList;

  events: IEvent;

  items: Map<string, string>;

  constructor() {
    this.registeredTasks = {};
    this.events = new events.EventEmitter();
    this.items = new Map<string, string>();
  }

  addNewTask(task: ITask) {
    this.events.emit('task_added', task);
    this.items.set(task.name, task.topic);
    this.registeredTasks[task.topic] = task;
  }

  removeTask(task: ITask) {
    this.events.emit('task_removed', task);
    delete this.registeredTasks[task.topic];
    this.items.delete(task.name);
  }

  getTopic(name: string): string {
    const value = this.items.get(name);
    if (!value) throw new Error('Unknown Task');
    return value;
  }

  getTopics(): Array<string> {
    return [...this.items.values()];
  }

  addTopic(name: string, topic?: string) {
    this.items.set(name, topic ?? name);
  }

  getTask(topic: string): ITask | null {
    return this.registeredTasks[topic] ? this.registeredTasks[topic] : null;
  }
}

export default Registry;
