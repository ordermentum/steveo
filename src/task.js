// @flow
import type { ITask, Callback, IProducer, IRegistry, Attribute } from '../types';

class Task implements ITask {
  subscribe: Callback;
  producer: IProducer;
  topic: string;
  name: string;
  attributes: Array<Attribute>;

  constructor(producer: IProducer,
    name: string, topic: string,
    subscribe: Callback,
    attributes: Array<Attribute> = []) {
    this.subscribe = subscribe;
    this.producer = producer;
    this.name = name;
    this.topic = topic;
    this.attributes = attributes;
  }

  register(registry: IRegistry) {
    const task = {
      topic: this.topic,
      subscribe: this.subscribe,
      attributes: this.attributes,
    };
    registry.addNewTask(task);
  }

  async execute(payload: Object) {
    return this.subscribe(payload);
  }

  async publish(payload: Object | Array<Object>) {
    return this.producer.publish(this.topic, payload);
  }
}

export default Task;
