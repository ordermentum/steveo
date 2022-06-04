import nullLogger from 'null-logger';
import { SQS } from 'aws-sdk';
import type { TransactionHandle } from 'newrelic';
import util from 'util';
import { getSqsInstance } from '../config/sqs';

import {
  Configuration,
  Logger,
  IProducer,
  IRegistry,
  sqsUrls,
  SQSConfiguration,
} from '../common';

import { createMessageMetadata } from './utils/createMessageMetadata';

class SqsProducer implements IProducer {
  config: Configuration;

  registry: IRegistry;

  logger: Logger;

  producer: SQS;

  sqsUrls: sqsUrls;

  private newrelic?: any;

  private transactionWrapper: <T>(
    txName: string,
    callback: (...args: any[]) => T
  ) => Promise<T>;

  constructor(
    config: Configuration,
    registry: IRegistry,
    logger: Logger = nullLogger
  ) {
    this.config = config;
    this.producer = getSqsInstance(config);
    this.logger = logger;
    this.registry = registry;
    this.sqsUrls = {};
    this.newrelic = config.traceConfiguration?.newrelic;
    this.transactionWrapper = (txName: string, func: any) =>
      this.newrelic
        ? this.newrelic.startBackgroundTransaction(txName, func)
        : func();
  }

  async initialize(topic: string): Promise<string> {
    if (!topic) {
      throw new Error('Topic cannot be empty');
    }

    const getQueueUrlResult = await this.producer
      .getQueueUrl({ QueueName: topic })
      .promise()
      .catch(() => undefined);
    const queueUrl = getQueueUrlResult?.QueueUrl;

    if (queueUrl) {
      this.sqsUrls[topic] = queueUrl;
      return queueUrl;
    }

    const config = this.config as SQSConfiguration;
    const params = {
      QueueName: topic,
      Attributes: {
        ReceiveMessageWaitTimeSeconds:
          config.receiveMessageWaitTimeSeconds ?? '20',
        MessageRetentionPeriod: config.messageRetentionPeriod ?? '604800',
      },
    };
    this.logger.debug(`Creating queue`, util.inspect(params));
    const res = await this.producer
      .createQueue(params)
      .promise()
      .catch(err => {
        throw new Error(`Failed to call SQS createQueue: ${err}`);
      });
    if (!res.QueueUrl) {
      throw new Error(
        `SQS createQueue response does not contain a queue name. Response: ${util.inspect(
          res.$response
        )}`
      );
    }
    this.sqsUrls[topic] = res.QueueUrl;
    return res.QueueUrl;
  }

  // Should getPayload be a part of the interface? Seems like an implementation detail.
  getPayload(
    msg: any,
    topic: string,
    transaction?: TransactionHandle
  ): {
    MessageAttributes: any;
    MessageBody: string;
    QueueUrl: string;
  } {
    const context = createMessageMetadata(msg, transaction);

    const task = this.registry.getTask(topic);
    const attributes = task ? task.attributes : [];
    const messageAttributes = {
      Timestamp: {
        DataType: 'Number',
        StringValue: context.timestamp.toString(),
      },
    };
    if (attributes) {
      attributes.forEach(a => {
        messageAttributes[a.name] = {
          DataType: a.dataType || 'String',
          StringValue: a.value.toString(),
        };
      });
    }

    return {
      MessageAttributes: messageAttributes,
      MessageBody: JSON.stringify({ ...msg, _meta: context }),
      QueueUrl: this.sqsUrls[topic],
    };
  }

  async send<T = Record<string, any>>(topic: string, payload: T) {
    // PR comment:
    // The above should be `payload: Record<string,any>` and not `any`. We
    // always do a messageBody = { ...payload }, which will mangle anything
    // that's not an object.
    // Passing a string payload "hello" gives '{"0":"h","1":"e","2":"l","3":"l","4":"o","_meta": ...
    // and passing ["hello"] gives '{"0":"bad-message","_meta": ...
    return this.transactionWrapper(`${topic}-publish`, async () => {
      try {
        if (!this.sqsUrls[topic]) {
          await this.initialize(topic);
        }
      } catch (ex) {
        this.newrelic?.noticeError(ex as Error);
        throw ex;
      }

      const transaction = this.newrelic?.getTransaction();
      const data = this.getPayload(payload, topic, transaction);

      try {
        await this.producer.sendMessage(data).promise();
        this.registry.emit('producer_success', topic, data);
      } catch (ex) {
        this.newrelic?.noticeError(ex as Error);
        this.registry.emit('producer_failure', topic, ex, data);
        throw ex;
      }
    });
  }

  async disconnect() {}

  async reconnect() {}
}

export default SqsProducer;
