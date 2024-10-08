/**
 * Options that define how queue/topic name will be formatted.
 */
export interface QueueFormatOptions {
  queueName?: string;
  queuePrefix?: string;
  upperCaseNames?: boolean;
}

/**
 * Standardised factory to produce a formatted topic name
 */
export function formatTopicName(
  name: string,
  options: QueueFormatOptions
): string {
  let topicName = options.queueName ?? name;
  if (options.queuePrefix) {
    topicName = `${options.queuePrefix}_${topicName}`;
  }

  const isUpperCase: boolean = options.upperCaseNames ?? false;
  return isUpperCase ? topicName.toUpperCase() : topicName;
}
