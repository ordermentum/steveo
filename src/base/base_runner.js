import intersection from 'lodash.intersection';
import shuffle from 'lodash.shuffle';

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
    this.preProcess = hooks.preProcess || function () { return Promise.resolve(); };
    this.healthCheck = hooks.healthCheck || function () { return Promise.resolve(); };
    this.terminationCheck = hooks.terminationCheck || function () { return Promise.resolve(false); };
    this.logger = {
      debug: console.log.bind(console),
      info: console.log.bind(console),
      warn: console.log.bind(console),
      error: console.log.bind(console),
    };
  }

  async checks(onFail) {
    if (await this.terminationCheck()) {
      this.logger.info('Terminating due to termination check');
      return process.exit(1);
    }

    try {
      await this.healthCheck();
    } catch (e) {
      this.logger.info(`Encountered healthcheck errors: ${e}`);
      this.errorCount += 1;
      if (this.errorCount > 5) {
        this.logger.info(`Terminating due to healthcheck count too high`);
        return process.exit(1);
      }
      return onFail();
    }

    await this.preProcess();
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
