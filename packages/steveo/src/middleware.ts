import { Callback, Middleware } from './common';

export function composePublish(middleware: Middleware[]) {
  if (!Array.isArray(middleware))
    throw new TypeError('Middleware stack must be an array!');

  return function (name: string, payload: any, publish: Callback) {
    // last called middleware #
    let index = -1;

    function dispatch(i) {
      if (i <= index)
        return Promise.reject(new Error('next() called multiple times'));

      index = i;
      let fn = middleware[i]?.publish;
      if (i === middleware.length) fn = publish;
      if (!fn) return Promise.resolve();
      try {
        return Promise.resolve(fn(name, payload, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}

export function composeConsume(middleware: Middleware[]) {
  if (!Array.isArray(middleware))
    throw new TypeError('Middleware stack must be an array!');

  return function (name: string, payload: any, consume: Callback) {
    // last called middleware #
    let index = -1;

    function dispatch(i) {
      if (i <= index)
        return Promise.reject(new Error('next() called multiple times'));

      index = i;
      let fn = middleware[i].consume;
      if (i === middleware.length) fn = consume;
      if (!fn) return Promise.resolve();
      try {
        return Promise.resolve(fn(name, payload, dispatch.bind(null, i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}
