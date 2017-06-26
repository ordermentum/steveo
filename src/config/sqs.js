import AWS from 'aws-sdk';

const sqs = config => new AWS.SQS({ region: config.region, apiVersion: config.apiVersion });

export default sqs;
