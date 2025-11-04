/* eslint-disable no-underscore-dangle */
import { StatsD } from 'hot-shots';
import { Steveo } from 'steveo';

export const build = (steveo: Steveo, stats: StatsD) => {
  steveo.events.on('producer_success', (topic, data) => {
    const tags: Record<string, string> = { topic };
    if (data?.MessageGroupId) {
      tags.partition = data.MessageGroupId;
    }
    stats.increment('producer_success', tags);
  });
  
  steveo.events.on('producer_failure', async (topic, _ex, payload, options) => {
    const tags: Record<string, string> = { topic };
    const partition = options?.key ?? payload?._meta?.key;
    if (partition) tags.partition = partition;
    stats.increment('producer_failure', tags);
  });

  steveo.events.on('runner_receive', (topic, _params, context) => {
    const tags: Record<string, string> = { topic };
    if (context?.key) {
      tags.partition = context.key;
    }
    stats.increment('runner_receive', tags);
    stats.histogram('runner_receive_ms', context.duration, tags);
  });

  steveo.events.on('runner_complete', async (topic, _params, context) => {
    const tags: Record<string, string> = { topic };
    if (context?.key) {
      tags.partition = context.key;
    }
    stats.increment('runner_complete', tags);
    stats.histogram('runner_success_ms', context.duration, tags);
  });

  steveo.events.on('runner_failure', async (topic, _ex, payload) => {
    const tags: Record<string, string> = { topic };
    if (payload?._meta?.key) {
      tags.partition = payload._meta.key;
    }
    stats.increment('runner_failure', tags);
  });
};

export default build;
