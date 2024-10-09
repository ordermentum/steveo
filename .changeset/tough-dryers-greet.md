---
"steveo": patch
---

Fix configuration bug after AWS SQS upgrade.
The issue occurred due to inconsistencies in local and non-local environments,
because locally the AWS credentials env variables are required an env vars while
in non-local we use the instance role, therefore the credentials are not required.

The fix consists of a new attribute credentials in the config, set during local
development only, which wrapper the AWS credentials.
