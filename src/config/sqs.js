import AWS from 'aws-sdk';

const sqs = (config) => {
  const instance = new AWS.SQS({
    region: config.region,
    apiVersion: config.apiVersion,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  });
  console.log('********process.env.NODE_ENV', process.env.NODE_ENV);
  if (process.env.NODE_ENV === 'development') {
    instance.setEndpoint(process.env.DEV_SQS);
    console.log(instance);
  }
  return instance;
};

export default sqs;
