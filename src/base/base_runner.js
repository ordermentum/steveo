import intersection from 'lodash.intersection';
import shuffle from 'lodash.shuffle';

import type { Logger, IRegistry } from '../../types';

class BaseRunner {
  registry: IRegistry;
  logger: Logger;

  getActiveSubsciptions(topics: Array<string> = null) : Array<string> {
    const subscriptions = this.registry.getTopics();
    const filtered = topics ? intersection(topics, subscriptions) : subscriptions;
    if (this.config.shuffleQueue) {
      return shuffle(filtered);
    }
    return filtered;
  }

  createQueues() : Promise<any> {
    const topics = this.registry.getTopics();
    this.logger.info('creating queues:', topics);
    return Promise.all(topics.map(topic => this.createQueue({ topic })));
  }

  createQueue() : Promise<any> {
    this.logger.info('createQueue API call');
    return Promise.resolve();
  }
}

export default BaseRunner;
