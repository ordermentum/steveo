// @flow

import KafkaTask from '../task/kafka';
import type { ITask, Configuration, IRegistry, IProducer, Callback } from '../../types';

type TasksType = {
  [key: string]: typeof KafkaTask,
};

const Tasks: TasksType = {
  kafka: KafkaTask,
};

const getTask = (
  type: string,
  config: Configuration,
  registry: IRegistry,
  producer: IProducer,
  topic: string,
  subscribe: Callback,
): ITask => new Tasks[type](config, registry, producer, topic, subscribe);

export default getTask;
