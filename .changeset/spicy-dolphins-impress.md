---
"steveo": patch
---

Fix SQS consumer issue preventing message context from being unpacked.
The code responsible for unpacking the context was accidentally removed during Steveo migration from v5 to v6.
