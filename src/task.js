// @flow
import type { ITask, Callback, IRegistry, Attribute } from '../types';

class Task implements ITask {
  subscribe: Callback;
  handler: Callback;
  topic: string;
  name: string;
  registry: IRegistry;
  attributes: Array<Attribute>;

  constructor(
    name: string,
    handler: Callback,
    registry: IRegistry,
    attributes: Array<Attribute> = []) {
    this.name = name;
    this.handler = handler;
    this.subscribe = this.handler;
    this.registry = registry;
    this.attributes = attributes;
  }

  register() {
    const task = {
      topic: this.topic,
      subscribe: this.subscribe,
      attributes: this.attributes,
    };
    this.registry.addNewTask(task);
  }

  getTopicName(): string {
    return this.registry.getTopicName(this.name);
  }

  async execute(payload: Object) {
    return this.handler(payload);
  }

  async publish(payload: Object | Array<Object>) {
    return this.registry.publish(this.topic, payload);
  }
}

export default Task;
