---
"steveo": major
"@steveojs/scheduler-sequelize": minor
"@steveojs/scheduler-prisma": minor
"@steveojs/newrelic": minor
"@steveojs/datadog": minor
"@steveojs/sentry": minor
"@steveojs/statsd": minor
---

Upgrade AWS SDK major version to 3.\*

Even though, there was no breaking change in Steveo the AWS SDK upgrade some core features that may cause unexpected
behavior in Steveo. So for, unit tests and manual tests haven't identified any inconsistency but that does not mean it
cannot still happen.

There were no changes in how Steveo should be used.
