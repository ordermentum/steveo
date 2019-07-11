import {
  ITask,
  Configuration,
  Callback,
  IProducer,
  IRegistry,
  Attribute,
} from './common';

class Task implements ITask {
  config: Configuration;

  registry: IRegistry;

  subscribe: Callback;

  producer: IProducer;

  topic: string;

  constructor(
    config: Configuration,
    registry: IRegistry,
    producer: IProducer,
    topic: string,
    subscribe: Callback,
    attributes: Attribute[] = [],
    doNotRegister: boolean = false
  ) {
    this.config = config;
    this.registry = registry;
    this.subscribe = subscribe;
    this.producer = producer;
    this.topic = topic;

    const task = {
      topic,
      subscribe: this.subscribe,
      attributes,
    };
    if (!doNotRegister) {
      this.registry.addNewTask(task);
    }
  }

  async publish(payload: any) {
    let params;
    if (!Array.isArray(payload)) {
      params = [payload];
    } else {
      params = payload;
    }

    try {
      await this.producer.initialize(this.topic);
      await Promise.all(
        params.map(data => {
          this.registry.events.emit('task_send', this.topic, data);
          return this.producer.send(this.topic, data);
        })
      );
      this.registry.events.emit('task_success', this.topic, payload);
    } catch (ex) {
      this.registry.events.emit('task_failure', this.topic, ex);
      throw ex;
    }
  }
}

export default Task;
