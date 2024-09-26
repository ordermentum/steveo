---
"@steveojs/datadog": patch
---

Fix datadog lib folder structure, introduced by latest minor upgrade.
In the 7.1.0 version, the tests folder was added to the includes list, in the
tsconfig.json which caused the compile `lib` folder to contains new src and test
folders instead of containing only the index.js entrypoint file.
