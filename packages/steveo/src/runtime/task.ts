import {
  ITask,
  KafkaConfiguration,
  RedisConfiguration,
  SQSConfiguration,
  DummyConfiguration,
  Callback,
  IProducer,
  IRegistry,
  IMessageRoutingOptions,
} from '../common';
import { TaskOptions } from '../types/task-options';

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

  options: TaskOptions;

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
    options: TaskOptions = {}
  ) {
    this.config = config;
    this.registry = registry;
    this.subscribe = subscribe;
    this.producer = producer;
    this.name = name;
    this.topic = topic;
    this.options = options;
  }

  async publish(payload: T | T[], options?: IMessageRoutingOptions) {
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
        params.map((data: T) => {
          this.registry.emit('task_send', this.topic, data);
          return this.producer.send(this.topic, data, options);
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
