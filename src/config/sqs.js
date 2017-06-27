import AWS from 'aws-sdk';

const sqs = (config) => {
  const instance = new AWS.SQS({
    region: config.region,
    apiVersion: config.apiVersion,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });
  return instance;
};

export default sqs;
