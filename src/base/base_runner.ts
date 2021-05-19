import intersection from 'lodash.intersection';
import shuffle from 'lodash.shuffle';
import logger from 'null-logger';
import {
  SQSConfiguration,
  Configuration,
  Logger,
  IRegistry,
  Hooks,
} from '../common';

class BaseRunner {
  async preProcess() {
    throw new Error('Unimplemented');
  }

  // @ts-ignore
  async createQueue(...data: any[]) {
    throw new Error('Unimplemented');
  }

  async healthCheck() {
    throw new Error('Unimplemented');
  }

  async terminationCheck(): Promise<boolean> {
    return true;
  }

  errorCount: number;

  registry?: IRegistry;

  // @ts-ignore
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

  async checks(onFail?: () => void, additionalCheck?: () => void) {
    try {
      if (await this.terminationCheck()) {
        this.logger.info('Terminating due to termination check');
        return process.exit(1);
      }
      await this.healthCheck();
      await this.preProcess();
      if (additionalCheck) {
        await additionalCheck();
      }
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
    if (!this.registry) return [];

    // We get the topics that we know how to process
    const subscriptions = this.registry.getTaskTopics();
    const filtered = topics
      ? intersection(topics, subscriptions)
      : subscriptions;
    if (this.config.shuffleQueue) {
      return shuffle(filtered);
    }
    return filtered;
  }

  async createQueues(): Promise<any> {
    if (!this.registry) return false;

    const topics = this.registry.getTopics();
    this.logger.debug('creating queues:', topics);
    return Promise.all(
      topics.map(topic =>
        this.createQueue({
          topic,
          receiveMessageWaitTimeSeconds: (this.config as SQSConfiguration)
            .receiveMessageWaitTimeSeconds,
          messageRetentionPeriod: (this.config as SQSConfiguration)
            .messageRetentionPeriod,
        }).catch(er => {
          this.logger.error('error creating queue for topic:', er);
          throw er;
        })
      )
    );
  }
}

export default BaseRunner;
