import {
  CreateQueueCommandInput,
  CreateQueueCommandOutput,
  GetQueueAttributesCommandInput,
  GetQueueAttributesCommandOutput,
  GetQueueUrlCommandInput,
  GetQueueUrlCommandOutput,
  SendMessageCommandInput,
  SQS,
} from '@aws-sdk/client-sqs';
import util from 'util';
import { getSqsInstance } from '../config/sqs';
import {
  IProducer,
  IRegistry,
  sqsUrls,
  SQSConfiguration,
  SQSMessageRoutingOptions,
} from '../common';
import { consoleLogger, Logger } from '../lib/logger';
import { createMessageMetadata } from '../lib/context';
import { BaseProducer } from './base';
import { Attribute } from '../types/task-options';

class SqsProducer extends BaseProducer implements IProducer {
  config: SQSConfiguration;

  registry: IRegistry;

  logger: Logger;

  producer: SQS;

  sqsUrls: sqsUrls;

  constructor(
    config: SQSConfiguration,
    registry: IRegistry,
    logger: Logger = consoleLogger
  ) {
    super(config.middleware ?? []);
    this.config = config;
    this.producer = getSqsInstance(config);
    this.logger = logger;
    this.registry = registry;
    this.sqsUrls = {};
  }

  async initialize(topic: string): Promise<string> {
    this.logger.debug(`Initializing topic: ${topic}`);

    if (!topic) {
      throw new Error('Topic cannot be empty');
    }

    let queueName = topic;

    const task = this.registry.getTask(topic);
    const fifo: boolean = !!task?.options?.fifo;

    const fifoAttributes: {
      FifoQueue?: string;
      ContentBasedDeduplication?: string;
    } = {};

    if (fifo) {
      queueName = `${queueName}.fifo`;
      fifoAttributes.FifoQueue = 'true';
      fifoAttributes.ContentBasedDeduplication = 'true';
    }

    const getQueueUrlResult: GetQueueUrlCommandOutput | undefined =
      await this.producer
        .getQueueUrl({
          QueueName: queueName,
        } as GetQueueUrlCommandInput)
        .catch(_ => undefined);
    const queueUrl: string | undefined = getQueueUrlResult?.QueueUrl;

    if (queueUrl) {
      this.sqsUrls[queueName] = queueUrl;
      return queueUrl;
    }

    const params: CreateQueueCommandInput = {
      QueueName: queueName,
      Attributes: {
        ReceiveMessageWaitTimeSeconds:
          this.config.receiveMessageWaitTimeSeconds ?? '20',
        MessageRetentionPeriod: this.config.messageRetentionPeriod ?? '604800',
        ...fifoAttributes,
      },
    };

    // Check if queue supports DLQ on the task config
    const redrivePolicy: Record<string, string> | null =
      await this.getDeadLetterQueuePolicy(queueName);

    // Append RedrivePolicy if supported
    if (redrivePolicy) {
      params.Attributes = {
        ...params.Attributes,
        RedrivePolicy: JSON.stringify(redrivePolicy),
      };
    }

    this.logger.debug(
      `${this.config.engine.toUpperCase()}: Creating queue`,
      util.inspect(params)
    );

    const res: CreateQueueCommandOutput = await this.producer
      .createQueue(params)
      .catch(err => {
        throw new Error(`Failed to call SQS createQueue: ${err}`);
      });

    if (!res.QueueUrl) {
      throw new Error('SQS createQueue response does not contain a queue name');
    }

    this.sqsUrls[queueName] = res.QueueUrl;
    return res.QueueUrl;
  }

  async getDeadLetterQueuePolicy(
    queueName: string
  ): Promise<Record<string, string> | null> {
    const task = this.registry.getTask(queueName);

    if (!task?.options?.deadLetterQueue) {
      return null;
    }

    const dlQueueName: string = `${queueName}_DLQ`;
    // try to fetch if there is an existing queueURL for QLQ
    const queueResult: GetQueueUrlCommandOutput | undefined =
      await this.producer
        .getQueueUrl({ QueueName: dlQueueName })
        .catch(_ => undefined);

    let dlQueueUrl: string = queueResult?.QueueUrl ?? '';

    // if we don't have existing DLQ, create one
    if (!dlQueueUrl) {
      const params: CreateQueueCommandInput = {
        QueueName: dlQueueName,
        Attributes: {
          ReceiveMessageWaitTimeSeconds:
            this.config.receiveMessageWaitTimeSeconds ?? '20',
          MessageRetentionPeriod:
            this.config.messageRetentionPeriod ?? '604800',
        },
      };

      this.logger.debug(
        `${this.config.engine.toUpperCase()}: Creating DLQ for orginal queue ${queueName}`,
        util.inspect(params)
      );

      const res: CreateQueueCommandOutput = await this.producer
        .createQueue(params)
        .catch(err => {
          throw new Error(
            `${this.config.engine.toUpperCase()}: Failed to call SQS createQueue: ${err}`
          );
        });

      if (!res.QueueUrl) {
        throw new Error(
          `${this.config.engine.toUpperCase()}: createQueue response does not contain a queue name`
        );
      }

      dlQueueUrl = res.QueueUrl;
    }

    // get the ARN of the DQL
    const getQueueAttributesParams: GetQueueAttributesCommandInput = {
      QueueUrl: dlQueueUrl,
      AttributeNames: ['QueueArn'],
    };

    const attributesResult: GetQueueAttributesCommandOutput =
      await this.producer
        .getQueueAttributes(getQueueAttributesParams)
        .catch(err => {
          throw new Error(
            `${this.config.engine.toUpperCase()}: Failed to call SQS getQueueAttributes: ${err}`
          );
        });

    const dlQueueArn: string | undefined =
      attributesResult.Attributes?.QueueArn;
    if (!dlQueueArn) {
      throw new Error(
        `${this.config.engine.toUpperCase()}: Failed to retrieve the DLQ ARN`
      );
    }

    return {
      deadLetterTargetArn: dlQueueArn,
      maxReceiveCount: (task.options.maxReceiveCount ?? 5).toString(),
    };
  }

  getPayload(
    msg: any,
    topic: string,
    options: SQSMessageRoutingOptions
  ): SendMessageCommandInput {
    const messageMetadata = {
      ...createMessageMetadata(msg),
      ...options,
    };

    const task = this.registry.getTask(topic);
    let attributes: Attribute[] = [] as Attribute[];
    if (task) {
      attributes = (task.options?.attributes ?? []) as Attribute[];
    }

    const messageAttributes = {
      Timestamp: {
        DataType: 'Number',
        StringValue: messageMetadata.timestamp.toString(),
      },
    };

    for (const a of attributes) {
      messageAttributes[a.name] = {
        DataType: a.dataType || 'String',
        StringValue: a.value.toString(),
      };
    }

    const fifo = !!task?.options?.fifo;

    const sqsTopic = fifo ? `${topic}.fifo` : topic;

    return {
      MessageAttributes: messageAttributes,
      MessageBody: JSON.stringify({ ...msg, _meta: messageMetadata }),
      QueueUrl: this.sqsUrls[sqsTopic],
      MessageGroupId: fifo && options.key ? options.key : undefined,
      MessageDeduplicationId:
        fifo && options.deDuplicationId ? options.deDuplicationId : undefined,
    } as SendMessageCommandInput;
  }

  async send<T = any>(
    topic: string,
    payload: T,
    options: SQSMessageRoutingOptions = {}
  ): Promise<void> {

    const handleError = (e: any) => {
      this.logger.error('Error while sending Payload', topic, e);
      this.registry.emit('producer_failure', topic, e, payload);
      throw e;
    }

    try {
      await this.wrap({ topic, payload }, async c => {
        try {
          if (!this.sqsUrls[c.topic]) {
            await this.initialize(c.topic);
          }
          const data: SendMessageCommandInput = this.getPayload(
            c.payload,
            c.topic,
            options
          );

          this.logger.debug('Sending Payload', c.topic, data);
          await this.producer.sendMessage(data);
          this.registry.emit('producer_success', c.topic, data);

        } catch(e) {
          handleError(e);  // This wont be caught by the parent try/catch becuase of wrap
        }
      });
    } catch (ex) {
      handleError(ex);
    }
  }
}

export default SqsProducer;
