import events from 'events';

import { IRegistry, IEvent, TaskList, RegistryElem } from '../common';

class Registry implements IRegistry {
  registeredTasks: TaskList;

  // TODO: Move up a level to the Steveo class
  events: IEvent;

  /**
   * Maps "tasks" to message queue provider topic (queue) names
   */
  items: Map<string, string>;

  heartbeat: number;

  constructor() {
    this.registeredTasks = {};
    this.heartbeat = new Date().getDate();
    this.events = new events.EventEmitter();
    this.items = new Map<string, string>();
  }

  emit(name: string, ...args: any) {
    this.heartbeat = Math.max(new Date().getTime(), this.heartbeat);
    this.events.emit(name, ...args);
  }

  addNewTask(task: RegistryElem) {
    this.emit('task_added', task);
    this.items.set(task.name, task.topic);
    this.registeredTasks[task.topic] = task;
  }

  removeTask(task: RegistryElem) {
    this.emit('task_removed', task);
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

  getTaskTopics(): Array<string> {
    return Object.keys(this.registeredTasks);
  }

  addTopic(name: string, topic?: string) {
    this.items.set(name, topic ?? name);
  }

  getTask(topic: string): RegistryElem | null {
    return this.registeredTasks[topic] ? this.registeredTasks[topic] : null;
  }
}

export default Registry;
