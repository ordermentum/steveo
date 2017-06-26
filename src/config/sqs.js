import AWS from 'aws-sdk';

const sqs = (config) => {
  const instance = new AWS.SQS({
    region: config.region,
    apiVersion: config.apiVersion,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });
  if (process.env.NODE_ENV === 'development') {
    instance.setEndpoint(process.env.DEV_SQS);
  }
  return instance;
};

export default sqs;
