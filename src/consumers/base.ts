import intersection from 'lodash.intersection';
import shuffle from 'lodash.shuffle';
import nullLogger from 'null-logger';
import { randomBytes } from 'crypto';
import { Steveo } from '..';
import {
  SQSConfiguration,
  Configuration,
  Logger,
  RunnerState,
} from '../common';
import { Manager } from '../lib/manager';

class BaseRunner {
  async preProcess() {
    throw new Error('Unimplemented');
  }

  // @ts-ignore
  async createQueue(...data: any[]) {
    throw new Error('Unimplemented');
  }

  errorCount: number;

  steveo: Steveo;

  config: Configuration;

  logger: Logger;

  manager: Manager;

  name: string;

  constructor(steveo: Steveo, name?: string) {
    this.errorCount = 0;
    this.preProcess = steveo?.hooks?.preProcess || (() => Promise.resolve());
    this.steveo = steveo;
    this.config = steveo?.config || {};
    this.logger = steveo?.logger ?? nullLogger;
    this.manager = this.steveo.manager;
    this.name =
      name ||
      `consumer-${this.constructor.name}-${randomBytes(16).toString('hex')}`;
  }

  get registry() {
    return this.steveo.registry;
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

  async healthCheck() {
    throw new Error('Unimplemented');
  }

  get state() {
    return this.manager.state;
  }

  set state(state: RunnerState) {
    this.manager.state = state;
  }

  async stop() {}

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
