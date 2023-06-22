A note on the lifecycle of jobs:

Jobs transition between 3 primary states: Dormant, Running (queued) and Accepted (processing).

Dormant: A job that is defined but is not currently running.
Running: A job that is in the process of being queued for processing
Accepted: A job that is currently working

There are a number of fields in job entries that define what state a job is in at any time.

Current states and some transitions are listed here:

Dormant: `queued == false &&  (last_run_at < accepted_at < last_finished_at < now < next_run_at)`

-> to run:  `queued == false &&  (last_run_at < accepted_at < last_finished_at < next_run_at < now)`

Running: `queued == true && (accepted_at < last_finished_at < next_run_at < last_run_at)`

-> blocked: `queued == true && (accepted_at < last_finished_at < next_run_at < last_run_at < now-10m)`

Accepted: `queued == true && (last_finished_at < next_run_at < last_run_at < accepted_at)`

-> laggy: `queued == true && (last_finished_at < next_run_at < last_run_at < accepted_at < now-6m)`

Deleted: `deleted_at != null`
