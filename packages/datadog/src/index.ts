/* eslint-disable no-underscore-dangle */
import tracer from 'dd-trace';
import { Middleware } from 'steveo';

export class DataDogMiddleware implements Middleware {
  publish(context, next) {
    return tracer.trace(
      'steveo.publish',
      {
        resource: context.topic,
        tags: {
          ...context.payload,
        },
      },
      () => next()
    );
  }

  async consume(context, next) {
    return tracer.trace(
      'steveo.consume',
      {
        resource: context.topic,
        tags: {
          ...context.payload,
        },
      },
      () => next()
    );
  }
}

export default DataDogMiddleware;
