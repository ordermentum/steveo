import intersection from 'lodash.intersection';
import shuffle from 'lodash.shuffle';
import nullLogger from 'null-logger';
import { randomBytes } from 'crypto';
import Bluebird from 'bluebird';
import { Steveo } from '..';
import { Configuration, Logger, Middleware, RunnerState } from '../common';
import { Manager } from '../lib/manager';
import { composeConsume } from '../middleware';

class BaseRunner {
  // @ts-ignore
  async createQueue(topic: string): Promise<boolean> {
    throw new Error('Unimplemented');
  }

  errorCount: number;

  steveo: Steveo;

  config: Configuration;

  logger: Logger;

  manager: Manager;

  name: string;

  middleware: Middleware[];

  constructor(steveo: Steveo, name?: string) {
    this.errorCount = 0;
    this.steveo = steveo;
    this.config = steveo?.config || {};
    this.middleware = steveo?.config?.middleware || [];
    this.logger = steveo?.logger ?? nullLogger;
    this.manager = this.steveo.manager;
    this.name =
      name ||
      `consumer-${this.constructor.name}-${randomBytes(16).toString('hex')}`;
  }

  get registry() {
    return this.steveo.registry;
  }

  get wrap() {
    return composeConsume(this.middleware ?? []);
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

  async disconnect() {}

  async reconnect() {}

  async stop() {
    this.logger.debug(
      `${this.config.engine.toUpperCase()}: stopping consumer ${this.name}`
    );
    this.manager.state = 'terminating';
  }

  async createQueues(): Promise<any> {
    if (!this.registry) return false;

    const topics = this.registry.getTopics();
    this.logger.debug(
      `${this.config.engine.toUpperCase()}: creating queues: ${topics}`
    );

    if (!topics || topics.length === 0) {
      this.logger.debug('no topics found');
      return false;
    }

    await Bluebird.map(
      topics,
      (topic: string) =>
        this.createQueue(topic).catch(er => {
          this.logger.error(
            `${this.config.engine.toUpperCase()}: error creating queue for topic: ${er.toString()}`
          );
        }),
      { concurrency: 10 }
    );

    return true;
  }
}

export default BaseRunner;
