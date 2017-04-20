// @flow
import type { Config, Callback, Reg, Producer } from '../types';

function Task(
  config: Config,
  registry: Reg,
  producer: Producer,
  topic: string,
  subscribeCallback: Callback) {
  const subscribe = (payload: any) => subscribeCallback(payload);

  const publish = async (payload: Array<Object> | any) => {
    let params = payload;

    if (!Array.isArray(payload)) {
      params = [payload];
    }

    try {
      await producer.initialize();
      await Promise.all(params.map(data => producer.send(topic, data)));
      registry.events.emit('task_success', topic, payload);
    } catch (ex) {
      registry.events.emit('task_failure', topic, ex);
      throw ex;
    }
  };

  const task = {
    topic,
    subscribe: subscribeCallback,
  };

  registry.addNewTask(task, producer);

  return {
    publish,
    subscribe,
  };
}

export default Task;
