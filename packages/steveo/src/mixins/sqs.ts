import SQS, { QueueAttributeMap } from 'aws-sdk/clients/sqs';
import util from 'util';
import { IRegistry, Logger, SQSConfiguration } from '../common';

export const SQSMessagingMixin = <T extends new (...args: any[]) => {}>(
  Base: T
) =>
  class extends Base {
    constructor(...args: any[]) {
      super(...args);
    }

    async getDeadLetterQueuePolicy(
      queueName: string,
      sqs: SQS,
      registry: IRegistry,
      config: SQSConfiguration,
      logger: Logger
    ): Promise<QueueAttributeMap | null> {
      const task = registry.getTask(queueName);

      if (!task?.options?.deadLetterQueue) {
        return null;
      }

      const dlQueueName = `${queueName}_DLQ`;
      // try to fetch if there is an existing queueURL for QLQ
      const queueResult = await sqs
        .getQueueUrl({ QueueName: dlQueueName })
        .promise()
        .catch(_ => undefined);

      let dlQueueUrl = queueResult?.QueueUrl;

      // if we don't have existing DLQ, create one
      if (!dlQueueUrl) {
        const params = {
          QueueName: dlQueueName,
          Attributes: {
            ReceiveMessageWaitTimeSeconds:
              config.receiveMessageWaitTimeSeconds ?? '20',
            MessageRetentionPeriod: config.messageRetentionPeriod ?? '604800',
          },
        };

        logger.debug(
          `Creating DLQ for orginal queue ${queueName}`,
          util.inspect(params)
        );

        const res = await sqs
          .createQueue(params)
          .promise()
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
      const getQueueAttributesParams = {
        QueueUrl: dlQueueUrl,
        AttributeNames: ['QueueArn'],
      };

      const attributesResult = await sqs
        .getQueueAttributes(getQueueAttributesParams)
        .promise()
        .catch(err => {
          throw new Error(`Failed to call SQS getQueueAttributes: ${err}`);
        });

      const dlQueueArn = attributesResult.Attributes?.QueueArn;

      if (!dlQueueArn) {
        throw new Error('Failed to retrieve the DLQ ARN');
      }

      return {
        deadLetterTargetArn: dlQueueArn,
        maxReceiveCount: (task?.options.maxReceiveCount ?? 5).toString(),
      };
    }
  };
