/* eslint-disable no-underscore-dangle */
import moment from 'moment';
import * as crypto from 'crypto';
import os from 'os';

export const createMessageMetadata = <T = any>(message: T) => {
  // @ts-expect-error
  const _meta = message?._meta ?? {};

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

export const getDuration = (start = undefined) => {
  const durationComponents = process.hrtime(start);
  const seconds = durationComponents[0];
  const nanoseconds = durationComponents[1];
  const duration = seconds * 1000 + nanoseconds / 1e6;
  return duration;
};

export const getContext = params => {
  const { _meta: meta } = params;

  if (!meta) {
    return { duration: 0 };
  }

  const duration = getDuration(meta.start);

  return {
    ...meta,
    duration,
  };
};
