import * as Sentry from '@sentry/node';
import { Steveo } from 'steveo';

export { SentryMiddleware } from './middleware';

export const build = (steveo: Steveo) => {
  steveo.events.on('producer_failure', async (_topic, ex) => {
    Sentry.captureException(ex);
  });

  steveo.events.on('runner_failure', async (_topic, ex, _params) => {
    Sentry.captureException(ex);
  });
};
