-- ══════════════════════════════════════════════════════════════
-- TeeTimeQuest — Round Cleanup
-- Deletes rounds (and their players, via CASCADE) the day after
-- the matched tee time date has passed.
--
-- Run this entire file in:
--   Supabase Dashboard → SQL Editor → New query → Run
--
-- Then follow the automation instructions in CLEANUP_AUTOMATION.md
-- ══════════════════════════════════════════════════════════════


-- ── 1. The cleanup function ──────────────────────────────────
-- Called by pg_cron or the Vercel cron job.
-- Deletes any round where:
--   a) status = 'matched' or 'booked'  AND  match->>'date' < today
--   b) status = 'collecting'           AND  created_at < 30 days ago (stale)

create or replace function cleanup_old_rounds()
returns json
language plpgsql
security definer   -- runs as the DB owner, bypasses RLS
as $$
declare
  deleted_matched  int;
  deleted_stale    int;
begin

  -- Delete played rounds (matched date has passed)
  with deleted as (
    delete from rounds
    where
      status in ('matched', 'booked')
      and (match->>'date')::date < current_date
    returning id
  )
  select count(*) into deleted_matched from deleted;

  -- Delete stale collecting rounds older than 30 days
  with deleted as (
    delete from rounds
    where
      status = 'collecting'
      and created_at < now() - interval '30 days'
    returning id
  )
  select count(*) into deleted_stale from deleted;

  return json_build_object(
    'deleted_played', deleted_matched,
    'deleted_stale',  deleted_stale,
    'ran_at',         now()
  );
end;
$$;


-- ── 2. Test it manually (safe — preview only) ────────────────
-- Run this to see what WOULD be deleted without actually deleting:

select
  id,
  city,
  status,
  match->>'date'    as tee_date,
  created_at::date  as created
from rounds
where
  (
    status in ('matched', 'booked')
    and (match->>'date')::date < current_date
  )
  or
  (
    status = 'collecting'
    and created_at < now() - interval '30 days'
  )
order by created_at;


-- ── 3. Run manually right now ────────────────────────────────
-- select cleanup_old_rounds();


-- ── 4. Schedule with pg_cron (if enabled on your Supabase plan) ──
-- Supabase Pro plan has pg_cron built in.
-- This runs the cleanup every day at 4:00 AM UTC:

-- select cron.schedule(
--   'cleanup-old-rounds',   -- job name
--   '0 4 * * *',            -- cron expression: 4am daily
--   'select cleanup_old_rounds()'
-- );

-- To check scheduled jobs:
-- select * from cron.job;

-- To remove the schedule:
-- select cron.unschedule('cleanup-old-rounds');
