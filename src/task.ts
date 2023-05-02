import {
  ITask,
  KafkaConfiguration,
  RedisConfiguration,
  SQSConfiguration,
  DummyConfiguration,
  Callback,
  IProducer,
  IRegistry,
  Attribute,
} from './common';

class Task<T = any, R = any> implements ITask<T, R> {
  config:
    | KafkaConfiguration
    | RedisConfiguration
    | SQSConfiguration
    | DummyConfiguration;

  registry: IRegistry;

  subscribe: Callback<T, R>;

  producer: IProducer;

  name: string;

  topic: string;

  attributes: Attribute[];

  constructor(
    config:
      | KafkaConfiguration
      | RedisConfiguration
      | SQSConfiguration
      | DummyConfiguration,
    registry: IRegistry,
    producer: IProducer,
    name: string,
    topic: string,
    subscribe: Callback<T, R>,
    attributes: Attribute[] = []
  ) {
    this.config = config;
    this.registry = registry;
    this.subscribe = subscribe;
    this.producer = producer;
    this.name = name;
    this.topic = topic;
    this.attributes = attributes;
  }

  async publish(payload: T | T[]) {
    let params;
    if (!Array.isArray(payload)) {
      params = [payload];
    } else {
      params = payload;
    }

    try {
      // sqs calls this method twice
      await this.producer.initialize(this.topic);
      await Promise.all(
        params.map(data => {
          this.registry.emit('task_send', this.topic, data);
          return this.producer.send(this.topic, data);
        })
      );
      this.registry.emit('task_success', this.topic, payload);
    } catch (ex) {
      this.registry.emit('task_failure', this.topic, ex);
      throw ex;
    }
  }
}

export default Task;
