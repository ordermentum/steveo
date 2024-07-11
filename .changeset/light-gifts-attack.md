---
"@steveojs/scheduler-sequelize": patch
"@steveojs/scheduler-prisma": patch
"steveo": patch
---

Fix bug that was causing Job data and Job context to be merged instead of 
passed separately to the task.publish method.

Schedules:

- Update taskRunner method to not merge the data together

Steveo:

 - Adjust producers to receive `data` and `context` separately and add context as a `_meta` attribute at message creation
time, before publishing a task payload to the queue. 
 - Adjust consumers to extract `data`  the `_meta` attribute from the message, to be passed to the Task callback 
separate input variables.
