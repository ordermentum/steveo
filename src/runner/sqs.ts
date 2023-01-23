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
  TraceProvider,
} from '../common';
import { Steveo } from '..';

type DeleteMessage = {
  instance: SQS;
  topic: string;
  message: any;
  sqsUrls: any;
  logger: Logger;
};

// FIXME: This is mostly boilerplate and doesn't need its own function
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

  private traceProvider?: TraceProvider;

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
    this.traceProvider = this.config.traceProvider as TraceProvider;
  }

  async receive(messages: SQS.MessageList, topic: string): Promise<any> {
    this.registry.emit('runner_messages', topic, messages);

    return bluebird.map(
      messages,
      async message => {
        let resource;
        const params = JSON.parse(message.Body as string);
        const runnerContext = getContext(params);
        const context = await this.traceProvider?.deserializeTraceMetadata(
          runnerContext.traceMetadata
        );

        const callback = async traceContext => {
          try {
            resource = await this.pool.acquire();

            this.registry.emit('runner_receive', topic, params, runnerContext);
            this.logger.debug('Deleting message', topic, params);

            await deleteMessage({
            // eslint-disable-line
              instance: this.sqs,
              topic,
              message,
              sqsUrls: this.sqsUrls,
              logger: this.logger,
            });

            this.logger.debug('Message deleted', topic, params);
            const task = this.registry.getTask(topic);
            this.logger.debug('Start subscribe', topic, params);
            if (!task) {
              this.logger.error(`Unknown Task ${topic}`);
              return;
            }

            const runFnAsSegment = async (
              segmentName: string,
              callback: (...args: any[]) => void
            ) => {
              if (!this.traceProvider) {
                await callback();
              } else {
                await this.traceProvider.wrapHandlerSegment(
                  segmentName,
                  traceContext,
                  // eslint-disable-next-line no-return-await
                  async () => await callback() // using `await` so we get accurate segment timing
                );
              }
            };

            await runFnAsSegment('runner.hooks.preTask', async () =>
              this.hooks?.preTask?.(params)
            );

            const { context = null, ...value } = params;
            let result;
            await runFnAsSegment('runner.task', async () => {
              result = await task.subscribe(value, context);
            });

            await runFnAsSegment('runner.hooks.postTask', async () =>
              this.hooks?.postTask?.({ ...(params ?? {}), result })
            );

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
            this.traceProvider?.onError?.(ex as Error, traceContext);
          }
          if (resource) await this.pool.release(resource);
        };

        this.traceProvider
          ? this.traceProvider.wrapHandler(`${topic}-runner`, context, callback)
          : callback(undefined);
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
