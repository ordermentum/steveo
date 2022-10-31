import intersection from 'lodash.intersection';
import shuffle from 'lodash.shuffle';
import nullLogger from 'null-logger';
import { Steveo } from '..';
import { SQSConfiguration, Configuration, Logger, IRegistry } from '../common';

class BaseRunner {
  async preProcess() {
    throw new Error('Unimplemented');
  }

  // @ts-ignore
  async createQueue(...data: any[]) {
    throw new Error('Unimplemented');
  }

  errorCount: number;

  registry?: IRegistry;

  steveo: Steveo;

  paused: boolean;

  // @ts-ignore
  config: Configuration;

  logger: Logger;

  constructor(steveo: Steveo) {
    this.errorCount = 0;
    this.preProcess = steveo?.hooks?.preProcess || (() => Promise.resolve());
    this.steveo = steveo;
    this.logger = steveo?.logger ?? nullLogger;
    this.paused = false;
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

  async pause() {
    this.paused = true;
  }

  async resume() {
    this.paused = false;
  }

  async healthCheck() {
    throw new Error('Unimplemented');
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
        })
      )
    );
  }
}

export default BaseRunner;
