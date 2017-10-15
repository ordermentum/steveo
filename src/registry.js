// @flow

import events from 'events';

import type { IRegistry, IEvent, Task, Callback, IProducer } from '../types';

let instance = null;

class Registry implements IRegistry {
  registeredTasks: Object;
  events: IEvent;
  producer: ?IProducer;
  topicName: Callback;

  constructor(producer: ?IProducer) {
    this.registeredTasks = {};
    this.producer = producer;
    this.events = new events.EventEmitter();
  }

  addNewTask(task: Task) {
    this.events.emit('task_added', task);
    this.registeredTasks[task.topic] = task;
  }

  static getInstance() {
    if (!instance) {
      instance = new Registry();
    }

    return instance;
  }

  publish(topic: string, payload: Array<mixed> | mixed) {
    if (!this.producer) {
      return Promise.reject('Unknown Producer');
    }

    return this.producer.publish(topic, payload);
  }

  getTopicName(topic: string): string {
    let topicName = topic;

    if (this.topicName && typeof this.topicName === 'function') {
      topicName = this.topicName(topic);
    }

    return topicName;
  }

  removeTask(task: Task) {
    this.events.emit('task_removed', task);
    delete this.registeredTasks[task.topic];
  }

  getTopics() : Array<string> {
    return Object.keys(this.registeredTasks);
  }
  getTask(topic: string) : Task {
    return this.registeredTasks[topic];
  }
}

export default Registry;
