
class KafkaTask {
  constructor(config, registry, producer, topic, subscribe) {
    this.config = config;
    this.registry = registry;
    this.subscribe = subscribe;
    this.producer = producer;
    this.topic = topic;
    const task = {
      topic,
      subscribe: this.subscribe,
    };
    this.registry.addNewTask(task, producer);
  }

  async publish(payload) {
    let params = payload;
    if (!Array.isArray(payload)) {
      params = [payload];
    }

    try {
      await this.producer.initialize();
      await Promise.all(params.map(data => this.producer.send(this.topic, data)));
      this.registry.events.emit('task_success', this.topic, payload);
    } catch (ex) {
      this.registry.events.emit('task_failure', this.topic, ex);
      throw ex;
    }
  }
}

export default KafkaTask;
