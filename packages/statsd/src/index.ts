/* eslint-disable no-underscore-dangle */
import { StatsD } from 'hot-shots';
import { Steveo } from 'steveo';

export const build = (steveo: Steveo, stats: StatsD) => {
  steveo.events.on('producer_success', topic => {
    stats.increment('producer_success', { topic });
  });

  steveo.events.on('producer_failure', async (topic, _ex) => {
    stats.increment('producer_failure', { topic });
  });

  steveo.events.on('runner_receive', (topic, _params, context) => {
    stats.increment('runner_receive', { topic });
    stats.histogram('runner_receive_ms', context.duration, { topic });
  });

  steveo.events.on('runner_complete', async (topic, _params, context) => {
    stats.increment('runner_complete', { topic });
    stats.histogram('runner_success_ms', context.duration, { topic });
  });

  steveo.events.on('runner_failure', async (topic, _ex, _params) => {
    stats.increment('runner_failure', { topic });
  });
};

export default build;
