/* eslint-disable no-underscore-dangle */
import { Steveo } from 'steveo';

/**
 * StatsD metrics client interface for instrumentation
 */
interface MetricsClient {
  /**
   * Increment a counter metric
   * @param name Metric name
   * @param value Value to increment by (default: 1)
   * @param tags Optional tags to add to the metric
   */
  increment(name: string, value?: number, tags?: Record<string, string>): void;

  /**
   * Record a timing/duration metric
   * @param name Metric name
   * @param value Duration in milliseconds
   * @param tags Optional tags to add to the metric
   */
  timing(name: string, value: number, tags?: Record<string, string>): void;

  /**
   * Record a gauge metric
   * @param name Metric name
   * @param value Gauge value
   * @param tags Optional tags to add to the metric
   */
  gauge(name: string, value: number, tags?: Record<string, string>): void;
}

export const build = (steveo: Steveo, stats: MetricsClient) => {
  steveo.events.on('producer_success', (topic, data) => {
    const tags: Record<string, string> = { topic };
    if (data?.MessageGroupId) {
      tags.partition = data.MessageGroupId;
    }
    stats.increment('producer_success', 1, tags);
  });

  steveo.events.on('producer_failure', async (topic, _ex, payload, options) => {
    const tags: Record<string, string> = { topic };
    const partition = options?.key ?? payload?._meta?.key;
    if (partition) tags.partition = partition;
    stats.increment('producer_failure', 1, tags);
  });

  steveo.events.on('runner_receive', (topic, _params, context) => {
    const tags: Record<string, string> = { topic };
    if (context?.key) {
      tags.partition = context.key;
    }
    stats.increment('runner_receive', 1, tags);
    stats.timing('runner_receive_ms', context.duration, tags);
  });

  steveo.events.on('runner_complete', async (topic, _params, context) => {
    const tags: Record<string, string> = { topic };
    if (context?.key) {
      tags.partition = context.key;
    }
    stats.increment('runner_complete', 1, tags);
    stats.timing('runner_success_ms', context.duration, tags);
  });

  steveo.events.on('runner_failure', async (topic, _ex, payload) => {
    const tags: Record<string, string> = { topic };
    if (payload?._meta?.key) {
      tags.partition = payload._meta.key;
    }
    stats.increment('runner_failure', 1, tags);
  });
};

export default build;
