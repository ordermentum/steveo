/* eslint-disable no-underscore-dangle */
import tracer from 'dd-trace';
import { Middleware } from 'steveo';

export class DataDogMiddleware implements Middleware {
  publish(context, next) {
    return tracer.trace(
      context.topic,
      {
        service: 'steveo',
        resource: context.topic,
        type: 'publish',
      },
      span => {
        if (span) {
          span.setBaggageItem('task', context.topic);
        }
        return next();
      }
    );
  }

  async consume(context, next) {
    return tracer.trace(
      context.topic,
      {
        service: 'steveo',
        resource: context.topic,
        type: 'consume',
      },
      () => next()
    );
  }
}

export default DataDogMiddleware;
