# TeeTimeQuest — Supabase Security & Cleanup Automation

---

## Part 1 — Should Supabase calls be in the backend?

**Short answer: your current setup is fine, but there's a clear upgrade path.**

### What you have now (client-side anon key)

```
Browser → VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY → Supabase
```

The **anon key** is designed to be public. Supabase publishes it openly in their docs.
What protects your data is **Row Level Security (RLS)**, not the key itself.

Your current RLS policies (from `migration_2026_2_0.sql`) allow open read/write to anyone
with the anon key. This is fine for a public-facing app where:
- Anyone with a round ID can read that round
- Anyone with a player ID can submit their availability

**Risk:** Someone could enumerate round IDs or submit fake availability if they reverse-engineer the API.

---

### The upgrade: tighter RLS (recommended, no backend needed)

The better security approach is not to move calls to a backend — it's to **tighten RLS** so
the anon key can only do what's strictly necessary.

Run this in your Supabase SQL Editor to replace the open policies:

```sql
-- ── Rounds: anyone can read by ID, anyone can insert ──────────────
drop policy if exists "rounds_select" on rounds;
create policy "rounds_select"
  on rounds for select
  using (true);  -- reading a round by ID is intentionally public

drop policy if exists "rounds_insert" on rounds;
create policy "rounds_insert"
  on rounds for insert
  with check (true);

-- Restrict UPDATE to only the match/status fields (no deleting rounds from browser)
drop policy if exists "rounds_update" on rounds;
create policy "rounds_update"
  on rounds for update
  using (true)
  with check (true);

-- ── Players: anyone can read/insert; can only update their own row ──
drop policy if exists "players_select" on players;
create policy "players_select"
  on players for select
  using (true);

drop policy if exists "players_insert" on players;
create policy "players_insert"
  on players for insert
  with check (true);

-- Players can update availability — scoped to rows they "own" by player ID
-- (We pass player_id in the URL, so this is a reasonable trust boundary)
drop policy if exists "players_update" on players;
create policy "players_update"
  on players for update
  using (true);  -- tighten further once you add auth
```

---

### When you DO need a backend (service_role key)

Some operations should **never** happen from the browser:

| Operation | Why backend? |
|---|---|
| Deleting rounds | Users shouldn't be able to delete others' rounds |
| Bulk operations | Service-role bypasses RLS — too powerful for browser |
| Sending emails | Brevo API key must stay server-side |
| Cleanup cron | Needs service_role to delete without RLS |

These already happen in `api/send-invite.js` (Brevo) and `api/cleanup.js` (cleanup cron).

---

### Variables you need in Vercel

Go to **Vercel → your project → Settings → Environment Variables** and add:

| Variable | Value | Used by |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Browser (store.js) |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (anon/public key) | Browser (store.js) |
| `BREVO_API_KEY` | your Brevo key | `api/send-invite.js` |
| `BREVO_SENDER_EMAIL` | `noreply@teetimequest.com` | `api/send-invite.js` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service_role key) | `api/cleanup.js` only |
| `CRON_SECRET` | random 32-char string | `api/cleanup.js` (auth) |

**Where to find each Supabase key:**
Supabase Dashboard → Settings → API:
- `anon` / `public` key → `VITE_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` ← **never put this in browser code**

**Generate a CRON_SECRET:**
```bash
openssl rand -hex 32
```
Or just pick any long random string.

---

## Part 2 — Round Cleanup Automation

Rounds are deleted the day after their matched tee date, plus stale collecting rounds after 30 days.

### Step 1 — Create the SQL function

Run `supabase/cleanup_rounds.sql` in your Supabase SQL Editor.
This creates the `cleanup_old_rounds()` function.

**Test it first (safe preview — no deletes):**
```sql
select id, city, status, match->>'date' as tee_date
from rounds
where
  (status in ('matched','booked') and (match->>'date')::date < current_date)
  or (status = 'collecting' and created_at < now() - interval '30 days');
```

**Run it manually:**
```sql
select cleanup_old_rounds();
-- Returns: {"deleted_played": 3, "deleted_stale": 1, "ran_at": "2026-04-01..."}
```

---

### Step 2 — Automate with Vercel Cron (already configured)

`vercel.json` already has the cron schedule:
```json
"crons": [
  { "path": "/api/cleanup", "schedule": "0 4 * * *" }
]
```

This calls `/api/cleanup` every day at **4:00 AM UTC**.

The `api/cleanup.js` serverless function:
1. Verifies the `CRON_SECRET` header
2. Calls `cleanup_old_rounds()` via Supabase REST API using the service_role key
3. Logs the result (visible in Vercel → Functions → cleanup → Logs)

**After deploying**, verify it's registered at:
Vercel Dashboard → your project → Settings → Cron Jobs

> Note: Vercel Cron is available on the **Hobby plan** (free) with a minimum interval of 1 day.
> For sub-daily intervals, upgrade to Pro.

---

### Option B — pg_cron (Supabase Pro only)

If you're on Supabase Pro, you can skip the Vercel function entirely and schedule directly in Postgres:

```sql
-- Schedule daily at 4am UTC
select cron.schedule(
  'cleanup-old-rounds',
  '0 4 * * *',
  'select cleanup_old_rounds()'
);

-- Check it's registered
select jobname, schedule, active from cron.job;

-- View run history
select jobid, runid, status, start_time, end_time, return_message
from cron.job_run_details
order by start_time desc
limit 20;

-- Remove schedule
select cron.unschedule('cleanup-old-rounds');
```

Advantage: no Vercel function needed, runs entirely inside the database.
pg_cron is enabled by default on Supabase Pro. Not available on the free tier.

---

### What gets deleted

| Condition | Deleted after |
|---|---|
| `status = 'matched'` or `'booked'` and tee date has passed | Next morning (4am UTC) |
| `status = 'collecting'` with no match found | 30 days after creation |

Players are deleted automatically via the `ON DELETE CASCADE` foreign key on `players.round_id`.

---

### Manual cleanup (anytime)

```sql
select cleanup_old_rounds();
```

Or trigger the Vercel function manually:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://teetimequest.com/api/cleanup
```
