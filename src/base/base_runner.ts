import intersection from 'lodash.intersection';
import shuffle from 'lodash.shuffle';
import logger from 'null-logger';

import { Configuration, Logger, IRegistry, Hooks } from '../common';

class BaseRunner {
  preProcess: () => Promise<void>;

  createQueue: (data: any) => Promise<any>;

  healthCheck: () => Promise<void>;

  terminationCheck: () => Promise<boolean>;

  errorCount: number;

  registry: IRegistry;

  config: Configuration;

  logger: Logger;

  constructor(hooks: Hooks = {}) {
    this.errorCount = 0;
    this.preProcess = hooks.preProcess || (() => Promise.resolve());
    this.healthCheck = hooks.healthCheck || (() => Promise.resolve());
    this.terminationCheck =
      hooks.terminationCheck || (() => Promise.resolve(false));
    this.logger = logger;
  }

  async checks(onFail?: () => void) {
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
      if (onFail) return onFail();
    }
    return null;
  }

  getActiveSubsciptions(topics?: string[]): string[] {
    const subscriptions = this.registry.getTopics();
    const filtered = topics
      ? intersection(topics, subscriptions)
      : subscriptions;
    if (this.config.shuffleQueue) {
      return shuffle(filtered);
    }
    return filtered;
  }

  createQueues(): Promise<any> {
    const topics = this.registry.getTopics();
    this.logger.debug('creating queues:', topics);
    return Promise.all(
      topics.map(topic =>
        this.createQueue({
          topic,
          receiveMessageWaitTimeSeconds: this.config
            .receiveMessageWaitTimeSeconds,
          messageRetentionPeriod: this.config.messageRetentionPeriod,
        })
      )
    );
  }
}

export default BaseRunner;
