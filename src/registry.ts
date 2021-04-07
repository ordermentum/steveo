import events from 'events';

import { IRegistry, IEvent, Task, TaskList } from './common';

class Registry implements IRegistry {
  registeredTasks: TaskList;

  events: IEvent;

  topics: Set<string>;

  constructor() {
    this.registeredTasks = {};
    this.events = new events.EventEmitter();
    this.topics = new Set<string>();
  }

  addNewTask(task: Task) {
    this.events.emit('task_added', task);
    this.topics.add(task.topic);
    this.registeredTasks[task.topic] = task;
  }

  removeTask(task: Task) {
    this.events.emit('task_removed', task);
    delete this.registeredTasks[task.topic];
    this.topics.delete(task.topic);
  }

  getTopics(): Array<string> {
    return [...this.topics];
  }

  addTopic(topic: string) {
    this.topics.add(topic);
  }

  getTask(topic: string): Task | null {
    return this.registeredTasks[topic] ? this.registeredTasks[topic] : null;
  }
}

export default Registry;
