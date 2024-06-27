# @steveojs/scheduler-prisma

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
- 6fde555: Upgrade to latest prisma client

## 6.0.1

### Patch Changes

- 6a3ad40: Adding a version commit

## 6.0.0

### Patch Changes

- Testing publishing
