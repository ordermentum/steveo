import nullLogger from 'null-logger';

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
  Logger,
  IProducer,
  IRegistry,
  sqsUrls,
  SQSConfiguration,
  Attribute,
  ITask,
} from '../common';

import { createMessageMetadata } from '../lib/context';
import { BaseProducer } from './base';

class SqsProducer extends BaseProducer implements IProducer {
  config: SQSConfiguration;

  registry: IRegistry;

  logger: Logger;

  producer: SQS;

  sqsUrls: sqsUrls;

  constructor(
    config: SQSConfiguration,
    registry: IRegistry,
    logger: Logger = nullLogger
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

    const task: ITask<any, any> | null = this.registry.getTask(topic);
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

    this.logger.debug(`Creating queue`, util.inspect(params));

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

    if (!task?.options.deadLetterQueue) {
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
        `Creating DLQ for orginal queue ${queueName}`,
        util.inspect(params)
      );

      const res: CreateQueueCommandOutput = await this.producer
        .createQueue(params)
        .catch(err => {
          throw new Error(`Failed to call SQS createQueue: ${err}`);
        });

      if (!res.QueueUrl) {
        throw new Error(
          'SQS createQueue response does not contain a queue name'
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
          throw new Error(`Failed to call SQS getQueueAttributes: ${err}`);
        });

    const dlQueueArn: string | undefined =
      attributesResult.Attributes?.QueueArn;
    if (!dlQueueArn) {
      throw new Error('Failed to retrieve the DLQ ARN');
    }

    return {
      deadLetterTargetArn: dlQueueArn,
      maxReceiveCount: (task.options.maxReceiveCount ?? 5).toString(),
    };
  }

  getPayload(
    msg: any,
    topic: string,
    key?: string,
    context: { [key: string]: string } = {}
  ): SendMessageCommandInput {
    const messageMetadata = {
      ...createMessageMetadata(msg),
      ...context,
    };

    const task: ITask | null = this.registry.getTask(topic);
    let attributes: Attribute[] = [] as Attribute[];
    if (task) {
      attributes = (task.options.attributes ?? []) as Attribute[];
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

    const fifo = !!task?.options.fifo;

    const sqsTopic = fifo ? `${topic}.fifo` : topic;

    return {
      MessageAttributes: messageAttributes,
      MessageBody: JSON.stringify({ ...msg, _meta: messageMetadata }),
      QueueUrl: this.sqsUrls[sqsTopic],
      MessageGroupId: fifo && key ? key : undefined,
    } as SendMessageCommandInput;
  }

  async send<T = any>(
    topic: string,
    payload: T,
    key?: string,
    context?: { [key: string]: string }
  ): Promise<void> {
    try {
      await this.wrap({ topic, payload }, async c => {
        if (!this.sqsUrls[c.topic]) {
          await this.initialize(c.topic);
        }
        const data: SendMessageCommandInput = this.getPayload(
          c.payload,
          c.topic,
          key,
          context
        );
        await this.producer.sendMessage(data);
        this.registry.emit('producer_success', c.topic, data);
      });
    } catch (ex) {
      this.logger.error('Error while sending Payload', topic, ex);
      this.registry.emit('producer_failure', topic, ex, payload);
      throw ex;
    }
  }
}

export default SqsProducer;
