import intersection from 'lodash.intersection';
import shuffle from 'lodash.shuffle';
import logger from 'null-logger';

import type {
  Logger,
  IRegistry,
  Hooks,
} from '../../types';

class BaseRunner {
  preProcess: () => Promise<void>;
  healthCheck: () => Promise<void>;
  terminationCheck: () => Promise<boolean>;
  errorCount: number;
  registry: IRegistry;
  logger: Logger;

  constructor(hooks: Hooks = {}) {
    this.errorCount = 0;
    this.preProcess = hooks.preProcess || (() => Promise.resolve());
    this.healthCheck = hooks.healthCheck || (() => Promise.resolve());
    this.terminationCheck = hooks.terminationCheck || (() => Promise.resolve(false));
    /* eslint-disable no-console */
    this.logger = logger;
    /* eslint-enable no-console */
  }

  async checks(onFail) {
    try {
      if (await this.terminationCheck()) {
        this.logger.info('Terminating due to termination check');
        return process.exit(1);
      }
      await this.healthCheck();
      await this.preProcess();
      return undefined;
    } catch (e) {
      this.logger.info(`Encountered healthcheck errors: ${e}`);
      this.errorCount += 1;
      if (this.errorCount > 5) {
        this.logger.info('Terminating due to healthcheck count too high');
        return process.exit(1);
      }
      return onFail();
    }
  }

  getActiveSubsciptions(topics: ?Array < string > = null): Array < string > {
    const subscriptions = this.registry.getTopics();
    const filtered = topics ? intersection(topics, subscriptions) : subscriptions;
    if (this.config.shuffleQueue) {
      return shuffle(filtered);
    }
    return filtered;
  }

  createQueues(): Promise < any > {
    const topics = this.registry.getTopics();
    this.logger.debug('creating queues:', topics);
    return Promise.all(topics.map(topic => this.createQueue({
      topic,
      receiveMessageWaitTimeSeconds: this.config.receiveMessageWaitTimeSeconds,
      messageRetentionPeriod: this.config.messageRetentionPeriod,
    })));
  }

  createQueue(): Promise < any > {
    this.logger.debug('createQueue API call');
    return Promise.resolve();
  }
}

export default BaseRunner;
