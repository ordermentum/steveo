/**
 *
 */
export interface QueueFormatOptions {
  queueName?: string;
  queuePrefix?: string;
  upperCaseNames?: boolean;
}

/**
 * Standardised factory to produce a formatted topic name
 */
export function formatTopicName(name: string, options: QueueFormatOptions) {
  const topic =
    options.queueName ??
    (options.queuePrefix ? `${options.queuePrefix}__${name}` : name);

  return options.upperCaseNames ? topic.toUpperCase() : topic;
}
