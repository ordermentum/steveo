import AWS from 'aws-sdk';

const sqs = new AWS.SQS({region: 'ap-southeast-2', apiVersion: '2012-11-05'});

export { sqs };
