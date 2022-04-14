/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
import NULL_LOGGER from 'null-logger';
import { ChildProcess } from 'child_process';
import { forkChild } from './util';
import {
  IRunner,
  Hooks,
  ITask,
  Configuration,
  Callback,
  Pool,
  Logger,
  ISteveo,
  IRegistry,
  IProducer,
  IEvent,
  Attribute,
  TaskOpts,
} from './common';
/* eslint-disable no-underscore-dangle */
import Task from './task';
import Registry from './registry';
import getRunner from './base/runner';
import producer from './base/producer';
import getConfig from './config';
import { build } from './base/pool';

export class Steveo implements ISteveo {
  config: Configuration;

  logger: Logger;

  registry: IRegistry;

  _producer?: IProducer;

  _runner?: IRunner;

  events: IEvent;

  pool: Pool<any>;

  hooks?: Hooks;

  childProcesses: Map<number, ChildProcess>;

  restarts: number;

  exiting: boolean;

  MAX_RESTARTS = 20;

  constructor(
    configuration: Configuration,
    logger: Logger = NULL_LOGGER,
    hooks?: Hooks
  ) {
    this.logger = logger;
    this.registry = new Registry();
    this.config = getConfig(configuration);
    this.pool = build(this.config.workerConfig);
    this.events = this.registry.events;
    this.hooks = hooks;
    this.childProcesses = new Map();
    this.restarts = 0;
    this.exiting = false;
  }

  task<T = any, R = any>(
    name: string,
    callback: Callback<T, R>,
    sqsAttributes: Attribute[] = [],
    attributes: TaskOpts = {}
  ): ITask<T> {
    const topic =
      attributes.queueName ??
      (this.config.queuePrefix ? `${this.config.queuePrefix}_${name}` : name);

    const task = new Task<T, R>(
      this.config,
      this.registry,
      this.producer,
      name,
      this.config.upperCaseNames ? topic.toUpperCase() : topic,
      callback,
      sqsAttributes
    );
    this.registry.addNewTask(task);

    return task;
  }

  async publish<T = any>(name: string, payload: T, key?: string) {
    const topic = this.registry.getTopic(name);
    return this.producer.send<T>(topic, payload, key);
  }

  getTopicName(name: string) {
    const withOrWithoutPrefix = this.config.queuePrefix
      ? `${this.config.queuePrefix}_${name}`
      : name;
    const uppercased = this.config.upperCaseNames
      ? withOrWithoutPrefix.toUpperCase()
      : withOrWithoutPrefix;
    return uppercased;
  }

  async registerTopic(name: string, topic?: string) {
    let topicName = topic;
    if (!topicName) {
      topicName = this.getTopicName(name);
    }

    this.registry.addTopic(name, topicName);
    await this.producer.initialize(topicName);
  }

  get producer() {
    if (!this._producer) {
      this._producer = producer(
        this.config.engine,
        this.config,
        this.registry,
        this.logger
      );
    }
    return this._producer;
  }

  private async exitHandler(
    code: number | null,
    child: ChildProcess | null,
    topic: string
  ) {
    const pid = child?.pid;

    if (pid) this.childProcesses.delete(pid);
    if (code === 0 || code === null) {
      this.logger.info(`Child ${pid} terminated`);
      if (this.childProcesses.size === 0) {
        process.exit(1);
      }
    }

    if (!this.exiting && this.restarts >= this.MAX_RESTARTS) {
      this.exiting = true;
      for (const process of this.childProcesses.values()) {
        process.kill();
      }
    }

    this.logger.info(`Restarting child ${pid}`);
    await this.startChild(topic);
  }

  private async startChild(topic) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise<void>(async (resolve, reject) => {
      try {
        // Give ample time to let the children start
        const timeout = setTimeout(() => {
          reject(new Error('Error forking child'));
        }, 30000);

        const child = await forkChild(
          topic,
          this.config.tasksPath,
          this.config.childProcesses
        );

        child.on('exit', code => {
          clearTimeout(timeout);
          this.exitHandler.call(this, code, child, topic);
        });
        process.on('error', e => {
          clearTimeout(timeout);
          this.logger.error(`Failed to start child process ${e}`);
          this.exitHandler.call(this, null, null, topic);
        });
        child.on('message', m => {
          clearTimeout(timeout);
          if (m === 'success') {
            resolve();
          } else {
            reject();
          }
        });
        if (child.pid) {
          this.childProcesses.set(child.pid, child);
          this.logger.debug(`spawned ${child.pid} for ${topic}`);
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * This pattern allows us to load all tasks in a directory
   * and as part of that they self register with the registry allowing
   */
  async loadTasks() {
    if (typeof this.config.tasksPath === 'undefined') {
      throw new Error('config.tasksPath not defined - failed to load tasks');
    }

    require(this.config.tasksPath);
  }

  async start(customTopics: string[] = []) {
    await this.loadTasks();
    const runner = this.runner();

    const topics = customTopics?.length
      ? customTopics
      : this.registry.getTopics();

    const topicsWithRegisteredTasks = topics.filter(
      topic => !!this.registry.getTask(topic)
    );

    if (!this.config.childProcesses) {
      runner.process(topicsWithRegisteredTasks);
    } else {
      await Promise.all(
        topicsWithRegisteredTasks.map(topic => this.startChild(topic))
      );
    }
  }

  runner() {
    if (!this._runner) {
      this._runner = getRunner({
        config: this.config,
        registry: this.registry,
        pool: this.pool,
        logger: this.logger,
        hooks: this.hooks,
      });
    }
    return this._runner;
  }

  disconnect() {
    this._producer?.disconnect();
    this._runner?.disconnect();
  }
}

export default (config: Configuration, logger: Logger, hooks?: Hooks) =>
  new Steveo(config, logger, hooks);
