import { Prisma } from '@prisma/client';

/*
    This query performs the following
      - Get jobs which are about to be run (queued === false && next_run_at < Current Timestamp && !deletedAt)
      - Lock these jobs using a key (key is JobID (UUID) -> bigint)
      - Enqueue these jobs (queued = true, last_run_at = Current Timestamp)
      - Note: We use transaction level non-blocking advisory locks to lock the keys, these locks will release themselves after the transaction completes
*/
/*
  Now that we have enqueued, we build a domain object (sorted by priority desc and then next_run_at)
*/
export const buildEnqueueJobsQuery = (
  jobs: string[],
  // eslint-disable-next-line default-param-last
  count = 1,
  namespace?: string
) => Prisma.sql`
    WITH updated as (
        UPDATE
        jobs
    SET
        queued = TRUE,
        last_run_at = CURRENT_TIMESTAMP
    WHERE
        id in (
            SELECT
                id
            FROM
                jobs
            WHERE
                queued = false
                AND name in (${Prisma.join(jobs)})
                AND next_run_at < CURRENT_TIMESTAMP
                AND deleted_at is null
                ${
                  namespace
                    ? Prisma.sql`AND namespace = ${namespace}`
                    : Prisma.sql``
                }
                AND pg_try_advisory_xact_lock(
                    ('x' || translate(id :: text, '-', '')) :: bit(64) :: bigint
                )
            LIMIT
              ${count}
            FOR UPDATE
        ) 
      RETURNING *
    )
    SELECT
        priority,
        name,
        count(*) AS total,
        jsonb_agg(
            jsonb_build_object(
                'id',
                id,
                'name',
                NAME,
                'data',
                data,
                'repeatInterval',
                repeat_interval,
                'lastFinishedAt',
                last_finished_at,
                'lastRunAt',
                last_run_at,
                'timezone',
                timezone,
                'failures',
                failures
                ${
                  namespace
                    ? Prisma.sql`,'namespace',coalesce(namespace, null)`
                    : Prisma.sql``
                }
            )
        ) AS items
    FROM
        updated
    GROUP BY
        1,
        2
    ORDER BY
        1 desc,
        2;
    `;
