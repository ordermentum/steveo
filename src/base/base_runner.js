import difference from 'lodash.difference';
import shuffle from 'lodash.shuffle';

class BaseRunner {
  getActiveSubsciptions(topics) {
    const subscriptions = this.registry.getTopics();
    const filtered = difference(subscriptions, topics);
    if (this.config.shuffleQueue) {
      return shuffle(filtered);
    }
    return filtered;
  }

  createQueues() {
    const topics = this.registry.getTopics();
    this.logger.info('creating queues:', topics);
    return Promise.all(topics.map(topic => this.createQueue({ topic })));
  }

  createQueue() {
    this.logger.info('createQueue API call');
    return true;
  }
}

export default BaseRunner;
