---
"steveo": patch
---

Adds a check to see if the kafka producer is connected before disconnecting. This prevents an error being thrown for an unconnected producer getting a disconnect call.
