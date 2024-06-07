---
"@steveojs/scheduler-sequelize": minor
"@steveojs/scheduler-prisma": minor
---

Deprecated computeNextRunAt method replaced by computeNextRun that leverages on the new rrule-rust library. Added computeNextRuns that generates n next occurences also leveraging on the new rrule-rust library. 
