import nullLogger from 'null-logger';
import { SQS } from 'aws-sdk';
import util from 'util';
import { getSqsInstance } from '../config/sqs';

import {
  Configuration,
  Logger,
  IProducer,
  IRegistry,
  sqsUrls,
  SQSConfiguration,
  TraceProvider,
} from '../common';

import { createMessageMetadata } from './utils/createMessageMetadata';

class SqsProducer implements IProducer {
  config: Configuration;

  registry: IRegistry;

  logger: Logger;

  producer: SQS;

  sqsUrls: sqsUrls;

  private traceProvider?: TraceProvider;

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
    this.traceProvider = this.config.traceProvider as TraceProvider;
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
      throw new Error('SQS createQueue response does not contain a queue name');
    }
    this.sqsUrls[topic] = res.QueueUrl;
    return res.QueueUrl;
  }

  getPayload(
    msg: any,
    topic: string,
    traceMetadata?: string
  ): {
    MessageAttributes: any;
    MessageBody: string;
    QueueUrl: string;
  } {
    const context = createMessageMetadata(msg, traceMetadata);

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
    const callback = async traceContext => {
      // eslint-disable-next-line no-useless-catch
      try {
        if (!this.sqsUrls[topic]) {
          await this.initialize(topic);
        }
      } catch (ex) {
        this.traceProvider?.onError?.(ex as Error, traceContext);
        throw ex;
      }

      const traceMetadata = await this.traceProvider?.serializeTraceMetadata(
        traceContext
      );
      const data = this.getPayload(payload, topic, traceMetadata);

      try {
        await this.producer.sendMessage(data).promise();
        this.registry.emit('producer_success', topic, data);
      } catch (ex) {
        this.traceProvider?.onError?.(ex as Error, traceContext);
        this.registry.emit('producer_failure', topic, ex, data);
        throw ex;
      }
    };

    this.traceProvider
      ? this.traceProvider.wrapHandler(`${topic}-publish`, undefined, callback)
      : await callback(undefined);
  }

  async disconnect() {}

  async reconnect() {}
}

export default SqsProducer;
