import { SQS } from 'aws-sdk';
import bluebird from 'bluebird';
import nullLogger from 'null-logger';
import BaseRunner from './base';
import { safeParseInt, getContext } from './utils';
import { getSqsInstance } from '../config/sqs';

import {
  Hooks,
  IRunner,
  Configuration,
  Pool,
  Logger,
  IRegistry,
  CreateSqsTopic,
  SQSConfiguration,
} from '../common';
import { Steveo } from '..';

type DeleteMessage = {
  instance: SQS;
  topic: string;
  message: any;
  sqsUrls: any;
  logger: Logger;
};

/* istanbul ignore next */
const deleteMessage = async ({
  instance,
  topic,
  message,
  sqsUrls,
  logger,
}: DeleteMessage) => {
  const deleteParams = {
    QueueUrl: sqsUrls[topic],
    ReceiptHandle: message.ReceiptHandle,
  };
  try {
    logger.debug('Deleting Message from Queue URL', deleteParams);
    const data = await instance.deleteMessage(deleteParams).promise();
    logger.debug('returned data', data);
    return data;
  } catch (ex) {
    logger.error('sqs deletion error', ex, topic, message);
    throw ex;
  }
};

class SqsRunner extends BaseRunner implements IRunner {
  config: Configuration<SQSConfiguration>;

  logger: Logger;

  registry: IRegistry;

  sqsUrls: any;

  sqs: SQS;

  pool: Pool<any>;

  concurrency: number;

  hooks?: Hooks;

  currentTimeout?: ReturnType<typeof setTimeout>;

  newrelic?: any;

  transactionWrapper: any;

  constructor(steveo: Steveo) {
    super(steveo);
    this.hooks = steveo?.hooks;
    this.config = steveo?.config || {};
    this.registry = steveo?.registry;
    this.logger = steveo?.logger ?? nullLogger;
    this.sqsUrls = {};
    this.sqs = getSqsInstance(steveo.config);
    this.pool = steveo.pool;
    this.concurrency = safeParseInt(steveo.config.workerConfig?.max, 1);
    this.newrelic = steveo?.config.traceConfiguration.newrelic;
    this.transactionWrapper = this.newrelic
      ? this.newrelic.startBackgroundTransaction
      : (_: string, callback) => callback();
  }

  async receive(messages: SQS.MessageList, topic: string): Promise<any> {
    this.registry.emit('runner_messages', topic, messages);

    return bluebird.map(
      messages,
      async message => {
        let resource;
        const params = JSON.parse(message.Body as string);
        const runnerContext = getContext(params);

        // TODO - Calling this.transactionWrapper doesn't work as NR seems to
        // call this.(parent).metrics or somesuch that gets broken when we
        // reassign it like in line 85.

        // Steveo: Error while invoking receive TypeError: Cannot read properties of undefined (reading 'agent')
        // at startBackgroundTransaction (/Users/zahav/ordermentum/infrastructure/samples-and-pocs/new-relic-apm-steveo/app/node_modules/newrelic/api.js:983:23)
        // at bluebird_1.default.map.concurrency (/Users/zahav/ordermentum/steveo/lib/runner/sqs.js:69:13)
        // at tryCatcher (/Users/zahav/ordermentum/steveo/node_modules/bluebird/js/release/util.js:16:23)
        // at MappingPromiseArray._promiseFulfilled (/Users/zahav/ordermentum/steveo/node_modules/bluebird/js/release/map.js:68:38)
        // at MappingPromiseArray.PromiseArray._iterate (/Users/zahav/ordermentum/steveo/node_modules/bluebird/js/release/promise_array.js:115:31)
        // at MappingPromiseArray.init (/Users/zahav/ordermentum/steveo/node_modules/bluebird/js/release/promise_array.js:79:10)
        // at MappingPromiseArray._asyncInit (/Users/zahav/ordermentum/steveo/node_modules/bluebird/js/release/map.js:37:10)
        // at _drainQueueStep (/Users/zahav/ordermentum/steveo/node_modules/bluebird/js/release/async.js:97:12)
        // at _drainQueue (/Users/zahav/ordermentum/steveo/node_modules/bluebird/js/release/async.js:86:9)
        // at Async._drainQueues (/Users/zahav/ordermentum/steveo/node_modules/bluebird/js/release/async.js:102:5)
        // at Immediate.Async.drainQueues (/Users/zahav/ordermentum/steveo/node_modules/bluebird/js/release/async.js:15:14)
        // at processImmediate (node:internal/timers:466:21)
        // at process.topLevelDomainCallback (node:domain:152:15)
        // at process.callbackTrampoline (node:internal/async_hooks:128:24)

        // Should extract below callback into a function and then do an either cb() or nr('txname', cb)

        this.newrelic.startBackgroundTransaction(
          `${topic}-runner`,
          async () => {
            try {
              if (this.newrelic && runnerContext.traceMetadata) {
                const transactionHandle = this.newrelic?.getTransaction();
                transactionHandle.acceptDistributedTraceHeaders(
                  'Queue',
                  runnerContext.traceMetadata
                );
              }

              resource = await this.pool.acquire();

              this.registry.emit(
                'runner_receive',
                topic,
                params,
                runnerContext
              );
              this.logger.debug('Deleting message', topic, params);

              await deleteMessage({
              // eslint-disable-line
                instance: this.sqs,
                topic,
                message,
                sqsUrls: this.sqsUrls,
                logger: this.logger,
              });

              this.logger.debug('Message Deleted', topic, params);
              const task = this.registry.getTask(topic);
              this.logger.debug('Start subscribe', topic, params);
              if (!task) {
                this.logger.error(`Unknown Task ${topic}`);
                return;
              }
              if (this.hooks?.preTask) {
                await this.newrelic?.startSegment(
                  'task.preTask',
                  true,
                  async () => {
                    await this.hooks?.preTask?.(params);
                  }
                );
              }
              const { context = null, ...value } = params;
              let result;
              await this.newrelic?.startSegment(
                'task.subscribe',
                true,
                async () => {
                  result = await task.subscribe(value, context);
                }
              );
              if (this.hooks?.postTask) {
                await this.newrelic?.startSegment(
                  'task.postTask',
                  true,
                  async () => {
                    await this.hooks?.postTask?.({ ...(params ?? {}), result });
                  }
                );
              }
              this.logger.debug('Completed subscribe', topic, params);
              const completedContext = getContext(params);
              this.registry.emit(
                'runner_complete',
                topic,
                params,
                completedContext
              );
            } catch (ex) {
              this.logger.error('Error while executing consumer callback ', {
                params,
                topic,
                error: ex,
              });
              this.registry.emit('runner_failure', topic, ex, params);
              this.newrelic?.noticeError(ex as Error);
            }
            if (resource) await this.pool.release(resource);
          }
        );
      },
      { concurrency: this.concurrency }
    );
  }

  async dequeue(params: SQS.ReceiveMessageRequest) {
    const data = await this.sqs
      .receiveMessage(params)
      .promise()
      .catch(e => {
        this.logger.error('Error while receiving message from queue', e);
        return null;
      });

    this.logger.debug('Message from sqs', data);
    return data?.Messages;
  }

  async process(topics?: string[]) {
    const loop = () => {
      if (this.state === 'terminating') {
        this.registry.emit('terminate', true);
        this.state = 'terminated';
        return;
      }

      if (this.currentTimeout) clearTimeout(this.currentTimeout);

      this.currentTimeout = setTimeout(
        this.process.bind(this, topics),
        this.config.consumerPollInterval ?? 1000
      );
    };

    if (this.state === 'paused') {
      this.logger.debug(`paused processing`);
      loop();
      return;
    }

    const subscriptions = this.getActiveSubsciptions(topics);
    this.logger.debug(
      `Polling for messages (${topics ? topics.join(',') : 'all'})`
    );

    await bluebird.map(
      subscriptions,
      async topic => {
        const queueURL = await this.getQueueUrl(topic);
        if (queueURL) {
          this.logger.debug(`starting processing of ${topic} with ${queueURL}`);

          const params = {
            MaxNumberOfMessages: this.config.maxNumberOfMessages,
            QueueUrl: queueURL,
            VisibilityTimeout: this.config.visibilityTimeout,
            WaitTimeSeconds: this.config.waitTimeSeconds,
          };
          const messages = await this.dequeue(params);

          if (!messages) {
            return;
          }
          try {
            await this.receive(messages, topic);
          } catch (ex) {
            this.logger.error('Error while invoking receive', ex);
          }
        } else {
          this.logger.error(`Queue URL ${topic} not found`);
        }
      },
      { concurrency: this.concurrency }
    );
    loop();
  }

  healthCheck = async function () {
    // get a random registered queue
    const items = this.registry.getTopics();
    const item = items[Math.floor(Math.random() * items.length)];
    await this.sqs.getQueueUrl({ QueueName: item }).promise();
  };

  async getQueueUrl(topic: string) {
    if (!this.sqsUrls[topic]) {
      this.logger.debug(`url not cached for ${topic}`);
      const url = await this.getUrl(topic);
      if (url) {
        this.sqsUrls[topic] = url;
      }
    }

    return this.sqsUrls[topic];
  }

  getUrl(topic: string) {
    return this.sqs
      .getQueueUrl({ QueueName: topic })
      .promise()
      .then(data => data && data?.QueueUrl)
      .catch(e => {
        this.logger.error(e);
        return null;
      });
  }

  async createQueue({
    topic,
    receiveMessageWaitTimeSeconds = '20',
    messageRetentionPeriod = '604800',
  }: CreateSqsTopic) {
    this.logger.info(`creating SQS queue ${topic}`);

    const params = {
      QueueName: topic,
      Attributes: {
        ReceiveMessageWaitTimeSeconds: receiveMessageWaitTimeSeconds,
        MessageRetentionPeriod: messageRetentionPeriod,
      },
    };
    await this.sqs.createQueue(params).promise();
  }

  async disconnect() {
    await this.terminate();

    if (this.currentTimeout) clearTimeout(this.currentTimeout);
  }

  async reconnect() {}
}

export default SqsRunner;
