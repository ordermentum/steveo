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
  const start = process.hrtime();
  const hostname = os.hostname();

  return { ..._meta, hostname, timestamp, signature, start };
};

export const getDuration = (
  start: [number, number] | undefined = undefined
): number => {
  const durationComponents: [number, number] = process.hrtime(start);
  const seconds: number = durationComponents[0];
  const nanoseconds: number = durationComponents[1];

  return seconds * 1000 + nanoseconds / 1e6;
};

export const getContext = params => {
  const { _meta: meta = {} } = params;

  let duration: number = 0;
  if (meta) {
    duration = getDuration(meta.start);
  }

  return { ...meta, duration };
};
