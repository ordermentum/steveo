---
"@steveojs/scheduler-sequelize": minor
"@steveojs/scheduler-prisma": minor
---

Fixed issue where `jobId` was not extracted correctly, causing jobs to not repeat. Updated argument handling to extract`jobId`, ensuring jobs reschedule as expected.
