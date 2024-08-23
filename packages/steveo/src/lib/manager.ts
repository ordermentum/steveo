/* eslint-disable no-underscore-dangle */
import { Steveo } from '..';
import { Logger, RunnerState } from '../common';
import { sleep } from './utils';

export class Manager {
  // FIXME: type issue with private property :/
  _state: RunnerState;

  steveo: Steveo;

  logger: Logger;

  constructor(steveo: Steveo) {
    this.steveo = steveo;
    this.logger = steveo.logger;
    this._state = 'running';
  }

  async resume() {
    this.logger.debug(`resuming runner`);
    this.state = 'running';
  }

  async pause() {
    this.logger.debug(`pausing runner`);
    this.state = 'paused';
  }

  // allow runner and producer to gracefully stop processing
  async stop() {
    this.logger.debug(`signal runner and producer to terminate`);
    await Promise.all([
      this.steveo?.runner()?.stop(),
      this.steveo?.producer?.stop(),
    ]);

    await this.shutdown();
  }

  async shutdown() {
    this.logger.debug(`shutting down`);

    if (['running', 'paused'].includes(this.state)) {
      this.state = 'terminating';
    }

    let count = 0;
    const tries = this?.steveo.config?.terminationWaitCount || 180;
    while (!this.isTerminated) {
      if (count === tries) {
        this.forceTerminate();
        break;
      }
      this.steveo.logger.debug(`waiting for consumers to terminate`);
      await sleep(1000);
      count += 1;
    }

    this.steveo.registry?.emit('terminate', true);
  }

  forceTerminate() {
    this.logger.debug(`force terminating runner`);
    this.state = 'terminated';
  }

  get isTerminated() {
    return this._state === 'terminated';
  }

  set state(state: RunnerState) {
    this.logger.debug(`runner state changed to ${state}`);
    this._state = state;
  }

  get state() {
    this.logger.debug(`runner state is ${this._state}`);
    return this._state;
  }

  get shouldTerminate() {
    return ['terminating', 'terminated'].includes(this._state);
  }
}
