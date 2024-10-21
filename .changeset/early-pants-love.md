---
"steveo": major
---

Update SQS configuration to use the AWS credentials chain to retrieve credetials from the environment.
It is no longer required to to provide them.

See [AWS Credentials chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html) for more details.
