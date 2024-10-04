import { expect } from 'chai';
import { formatTopicName } from "../../src/lib/formatters";
import { QueueFormatOptions } from "../../lib/lib/formatters";

describe('Formatters', () => {

  describe('formatTopicName', () => {

    it('should prefix name with "QueueFormatOptions.queuePrefix" if set', () => {
      const topic: string = 'my-topic';
      const prefix: string = 'my-prefix';
      const queueFormatOptions: QueueFormatOptions = {
        queuePrefix: prefix
      }

      const expectedTopic: string = `${prefix}_my-topic`;
      const formattedTopicName: string = formatTopicName(topic, queueFormatOptions);
      expect(expectedTopic).to.be.equal(formattedTopicName);
    });

    it('should convert topic to uppercase if "QueueFormatOptions.upperCaseNames" is set to true', () => {
      const topic: string = 'my-topic';
      const queueFormatOptions: QueueFormatOptions = {
        upperCaseNames: true
      }

      const expectedTopic: string = topic.toUpperCase();
      const formattedTopicName: string = formatTopicName(topic, queueFormatOptions);
      expect(expectedTopic).to.be.equal(formattedTopicName);
    });

    it('should use "QueueFormatOptions.queueName" as topic name if set', () => {
      const topic: string = 'my-topic';
      const nameInTaskOptions: string = 'name-in-task-options';
      const queueFormatOptions: QueueFormatOptions = {
        queueName: nameInTaskOptions,
      }

      const expectedTopic: string = nameInTaskOptions;
      const formattedTopicName: string = formatTopicName(topic, queueFormatOptions);
      expect(expectedTopic).to.be.equal(formattedTopicName);
    });
  });
});
