import nullLogger from 'null-logger';
import { SQS } from 'aws-sdk';
import type { TransactionHandle } from 'newrelic';
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

  private transactionWrapper: any;

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
    this.transactionWrapper = (txname: string, func: any) =>
      this.newrelic
        ? this.newrelic.startBackgroundTransaction(txname, func)
        : func();
  }

  async initialize(topic?: string) {
    if (!topic) {
      throw new Error('Topic cannot be empty');
    }

    const data = await this.producer
      .getQueueUrl({ QueueName: topic })
      .promise()
      .catch();

    const queue = data?.QueueUrl;

    if (queue) {
      this.sqsUrls[topic] = queue;
      return queue;
    }

    const config = this.config as SQSConfiguration;
    const params = {
      QueueName: topic,
      Attributes: {
        ReceiveMessageWaitTimeSeconds: config.receiveMessageWaitTimeSeconds,
        MessageRetentionPeriod: config.messageRetentionPeriod,
      },
    };
    // TODO - Test this
    const res = await this.producer.createQueue(params).promise();
    if (!res.QueueUrl) {
      throw new Error(
        `Failed to create SQS queue: ${res.$response.error?.message}`
      );
    }
    this.sqsUrls[topic] = res.QueueUrl;
    return res.QueueUrl;
  }

  // Should getPayload be a part of the interface? Seems like an implementation detail.
  getPayload(msg: any, topic: string, transaction?: TransactionHandle): any {
    const context = createMessageMetadata(msg, transaction);

    // Why are we looking at tasks on the producer side?
    // What do these attributes do? Why can't they be in the message body?
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

  async send<T = any>(topic: string, payload: T) {
    this.transactionWrapper(`${topic}-publish`, async () => {
      try {
        await this.initialize(topic);
      } catch (ex) {
        this.newrelic?.noticeError(ex as Error);
        this.logger.error('Error in initalizing sqs', ex);
        throw ex;
      }

      const transaction = this.newrelic?.getTransaction();
      const data = this.getPayload(payload, topic, transaction);

      try {
        const response = await this.producer.sendMessage(data).promise();
        this.logger.debug('SQS Publish Data', response);
        this.registry.emit('producer_success', topic, data);
      } catch (ex) {
        this.newrelic?.noticeError(ex as Error);
        this.logger.error('Error while sending SQS payload', topic, ex);
        this.registry.emit('producer_failure', topic, ex, data);
        throw ex;
      }
    });
  }

  async disconnect() {}

  async reconnect() {}
}

export default SqsProducer;
