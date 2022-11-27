import intersection from 'lodash.intersection';
import shuffle from 'lodash.shuffle';
import nullLogger from 'null-logger';
import { Steveo } from '..';
import {
  SQSConfiguration,
  Configuration,
  Logger,
  IRegistry,
  RunnerState,
} from '../common';
import { sleep } from './utils';

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

  state: RunnerState;

  // @ts-ignore
  config: Configuration;

  logger: Logger;

  constructor(steveo: Steveo) {
    this.errorCount = 0;
    this.preProcess = steveo?.hooks?.preProcess || (() => Promise.resolve());
    this.steveo = steveo;
    this.registry = steveo?.registry;
    this.config = steveo?.config || {};
    this.logger = steveo?.logger ?? nullLogger;
    this.state = 'running';
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

  async resume() {
    this.state = 'running';
  }

  async pause() {
    this.state = 'paused';
  }

  async terminate() {
    if (['running', 'paused'].includes(this.state)) {
      this.state = 'terminating';
    }

    while (this.state !== 'terminated') {
      await sleep(5000);
    }
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
