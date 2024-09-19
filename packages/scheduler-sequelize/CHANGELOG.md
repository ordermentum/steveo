# @steveojs/scheduler-sequelize

## 7.4.0

### Minor Changes

- f1392ba: Upgrade AWS SDK major version to 3.\*

  Even though, there was no breaking change in Steveo the AWS SDK upgrade some core features that may cause unexpected
  behavior in Steveo. So for, unit tests and manual tests haven't identified any inconsistency but that does not mean it
  cannot still happen.

  There were no changes in how Steveo should be used.

## 7.3.0

### Minor Changes

- eb96d41: Support recurrence rules that have DTSTART at the end of the recurrence string

## 7.2.1

### Patch Changes

- 1ff81d7: Fix bug that was causing Job data and Job context to be merged instead of
  passed separately to the task.publish method.

  Schedules:

  - Update taskRunner method to not merge the data together

  Steveo:

  - Adjust producers to receive `data` and `context` separately and add context as a `_meta` attribute at message creation
    time, before publishing a task payload to the queue.
  - Adjust consumers to extract `data` the `_meta` attribute from the message, to be passed to the Task callback
    separate input variables.

## 7.2.0

### Minor Changes

- 2ed3a1e: Bump dependencies

## 7.1.0

### Minor Changes

- 6517b6e: Deprecated computeNextRunAt method replaced by computeNextRun that leverages on the new rrule-rust library. Added computeNextRuns that generates n next occurences also leveraging on the new rrule-rust library.

## 7.0.0

### Major Changes

- 00e72e8: Use rrule-rust instead of lunartick for rrule strings

## 6.1.1

### Patch Changes

- 06f8a49: Don't fail if no task not called with any arguments

## 6.1.0

### Minor Changes

- a87d9d8: Fixed issue where `jobId` was not extracted correctly, causing jobs to not repeat. Updated argument handling to extract`jobId`, ensuring jobs reschedule as expected.
- 7f46fa9: Add pending jobs event

## 6.0.1

### Patch Changes

- 6a3ad40: Adding a version commit

## 6.0.0

### Patch Changes

- Testing publishing
