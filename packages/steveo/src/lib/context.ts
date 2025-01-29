/* eslint-disable no-underscore-dangle */
import moment from 'moment';
import * as crypto from 'crypto';
import os from 'os';

export const createMessageMetadata = <T = any>(message: T) => {
  // @ts-expect-error
  const _meta = message._meta ?? {};

  const sha1 = crypto.createHash('sha1'); // can we change this to SHA256?
  const signature = sha1
    .update(JSON.stringify({ ...message, _meta: undefined }))
    .digest('hex')
    .substring(0, 8);
  const timestamp = moment().unix();
  /**
   * Normally, you'll use the `process.hrtime()` method to get the current high-resolution real time in a [seconds, nanoseconds] tuple Array.
   * Since messages can pass process boundaries, we'll use the `Date.now()` method to get the current Unix timestamp.
   *
   * We lose resolution against `process.hrtime()` (Nanoseconds v/s Milliseconds), but we gain consistency across processes since hrtime is relative to the process start time.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now
   * @see https://nodejs.org/api/process.html#process_process_hrtime_time
   *
   * Note: Date.now() can also differ between processes, but it's a better choice than process.hrtime() for our use case.
   * Ideally, we'll sync the time across all services using NTP.
   */
  const start = Date.now(); // Milliseconds since Unix epoch
  const hostname = os.hostname();

  return { ..._meta, hostname, timestamp, signature, start };
};

export const getDuration = (startMs: number) => Date.now() - startMs;

export const getContext = params => {
  const { _meta: meta = {} } = params;

  // 0 lets us filter out messages that don't have a start time
  let duration: number = 0;
  // Array check is to ignore in-flight messages with a start time emitted by the process.hrtime() method
  if (meta?.start && !Array.isArray(meta.start)) {
    duration = getDuration(meta.start);
  }

  return { ...meta, duration };
};
