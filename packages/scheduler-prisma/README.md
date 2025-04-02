⚠️ **DEPRECATION NOTICE**

> **This package is deprecated and no longer actively maintained.**
> 
> Users are strongly recommended to migrate to the consolidated `@ordermentum/scheduler` package.

# steveo-scheduler-prisma

A scheduler provider for [steveo](https://github.com/ordermentum/steveo) library.

- Computes next run of a schedule
- Computes n next run occurences of a schedule

### What's new
Version 7.1.0

- Deprecated `computeNextRunAt` method replaced by `computeNextRun` that uses the rrule-rust library
    #### Usage
    ```
    computeNextRunAt(interval, 'UTC') ---> OLD
    computeNextRun(interval, { timezone: 'UTC', startDate: moment().toISOString() }) ---> NEW
    ```
- `computeNextRun` will check if the rule is valid, convert to a valid rule if not and return a single run date in ISO string
    #### Parameters
     - interval: should be an [iCal](https://icalendar.org/rrule-tool.html) rrule string
     - timezone: timezone to compute the next run, UTC by default
     - startDate: start date to compute the next run, now() by default
    #### Usage
    ```
    computeNextRun(interval, { timezone: 'UTC', startDate: moment().toISOString() })
    ```
- `computeNextRuns` similar to `computeNextRun` but will return n next run dates in ISO string
    #### Parameters
     - interval: should be an [iCal](https://icalendar.org/rrule-tool.html) rrule string
     - timezone: timezone to compute the next run, UTC by default
     - startDate: start date to compute the next run, now() by default
     - count: number of occurrences, 1 by default max of 30
    #### Usage
    ```
    computeNextRuns(interval, { timezone: 'Australia/Sydney', startDate: moment().toISOString(), count: 5 })