/* eslint-disable no-underscore-dangle */
import { Steveo } from '..';
import { RunnerState } from '../common';
import { Logger } from './logger';
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

  /**
   * Drain and clear the pools managed by global.steveo.
   *
   * @private
   */
  async _drainAndClearPools() {
    // Steveo maintains a list of pools that need to be drained and cleared
    // Look at packages/steveo/src/lib/pool.ts for more info
    const pools = global.steveo?.pools;

    if (!pools || pools.length === 0) {
      return;
    }

    await Promise.all(
      pools.map(async (pool) => {
        try {
          if (pool.borrowed > 0) {
            await pool.drain();
            await pool.clear();
          }
        } catch (error) {
          this.logger.error('Error draining and clearing pool', error);
        }
      })
    );
  }

  /**
   * Gracefully shuts down the system by stopping the runner, producer, and draining/clearing any active pools.
   *
   * - Signals the runner to terminate
   * - Initiates the shutdown, which waits for a set amount of time before force terminating the runner.
   * - If there are any active pools managed by Steveo, it ensures that:
   *    1. All borrowed items are drained from the pool.
   *    2. The pool is cleared to prevent any lingering resources.
   * - Signals the producer to terminate
   * - Handles any errors that occur during the draining/clearing process.
   *
   */
  async stop() {
    this.logger.debug('signal runner and producer to terminate');
    await this.shutdown();
  }

  async shutdown() {
    this.logger.debug('shutting down');

    if (['running', 'paused'].includes(this.state)) {
      this.state = 'terminating';
    }

    let count = 0;
    const tries = this.steveo.config.terminationWaitCount || 180;
    while (!this.isTerminated) {
      if (count === tries) {
        this.forceTerminate();
        break;
      }
      this.steveo.logger.debug('waiting for consumers to terminate');
      await sleep(1000);
      count += 1;
    }
    await this._drainAndClearPools();
    await this.steveo.producer.stop();
    this.steveo.registry.emit('terminate', true);
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

  terminate() {
    this.logger.debug('gracefully terminating runner');
    this.state = 'terminated';
  }
}
