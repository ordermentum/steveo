import { Middleware, MiddlewareContext, MiddlewareCallback } from './common';

export function composePublish(middleware: Middleware[]) {
  return function (context: MiddlewareContext, next: MiddlewareCallback) {
    let index = -1;

    function dispatch(i: number) {
      if (i <= index)
        return Promise.reject(new Error('next() called multiple times'));

      index = i;
      let fn = middleware[i]?.publish;
      if (i === middleware.length) {
        fn = next;
      }
      if (!fn) return Promise.resolve();

      fn = fn.bind(middleware[i]);

      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}

export function composeConsume(middleware: Middleware[]) {
  return function (context: MiddlewareContext, next: MiddlewareCallback) {
    let index = -1;

    function dispatch(i: number) {
      if (i <= index)
        return Promise.reject(new Error('next() called multiple times'));

      index = i;
      let fn = middleware[i]?.consume;
      if (i === middleware.length) fn = next;
      if (!fn) return Promise.resolve();
      fn = fn.bind(middleware[i]);

      try {
        return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}
