import difference from 'lodash.difference';

class BaseRunner {
  getActiveSubsciptions(topics) {
    const subscriptions = this.registry.getTopics();
    const filtered = difference(subscriptions, topics);
    return filtered;
  }

  createQueue() {
    this.logger.info('createQueue API call');
    return true;
  }
}

export default BaseRunner;
