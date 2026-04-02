-- ══════════════════════════════════════════════════════════════
-- TeeTimeQuest — Supabase Schema
-- Version: 2026.2.0
--
-- Run this entire file in:
--   Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- Run it once. It is idempotent (safe to re-run).
-- ══════════════════════════════════════════════════════════════


-- ── Enable UUID extension (already on by default in Supabase) ──
-- create extension if not exists "uuid-ossp";


-- ══════════════════════════════════════════════════════════════
-- TABLE: rounds
-- ══════════════════════════════════════════════════════════════
create table if not exists rounds (
  id          text        primary key,
  city        text        not null,
  status      text        not null default 'collecting',  -- 'collecting' | 'matched' | 'booked'
  match       jsonb,                                       -- null until all players respond
  created_at  timestamptz not null default now()
);

comment on table  rounds            is 'One row per golf round coordination session.';
comment on column rounds.id         is 'nanoid(10) generated client-side.';
comment on column rounds.status     is 'collecting = waiting for responses; matched = date/course found; booked = confirmed.';
comment on column rounds.match      is 'JSON: { date, teeTime, suggestedCourses, confirmedCourse, commonDatesCount }';


-- ══════════════════════════════════════════════════════════════
-- TABLE: players
-- ══════════════════════════════════════════════════════════════
create table if not exists players (
  id            text        primary key,
  round_id      text        not null references rounds(id) on delete cascade,
  name          text        not null,
  email         text        not null,
  is_organizer  boolean     not null default false,
  availability  jsonb,                                     -- null until player submits
  responded_at  timestamptz,
  created_at    timestamptz not null default now()
);

comment on table  players               is 'One row per player in a round.';
comment on column players.id            is 'nanoid(6) generated client-side.';
comment on column players.availability  is 'JSON: { location, dates: string[], timePreferences: string[] }';


-- ── Indexes ──────────────────────────────────────────────────
create index if not exists players_round_id_idx on players(round_id);
create index if not exists rounds_created_at_idx on rounds(created_at desc);


-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
--
-- TeeTimeQuest uses the anon key with no user auth.
-- We open up read/write to the anon role for now.
-- When you add auth, tighten these policies.
-- ══════════════════════════════════════════════════════════════
alter table rounds  enable row level security;
alter table players enable row level security;

-- Anyone with the anon key can read rounds
drop policy if exists "rounds_select" on rounds;
create policy "rounds_select"
  on rounds for select
  using (true);

-- Anyone can insert a new round (creating one)
drop policy if exists "rounds_insert" on rounds;
create policy "rounds_insert"
  on rounds for insert
  with check (true);

-- Anyone can update a round (status + match updates after availability is saved)
drop policy if exists "rounds_update" on rounds;
create policy "rounds_update"
  on rounds for update
  using (true);

-- Anyone with the anon key can read players in any round
drop policy if exists "players_select" on players;
create policy "players_select"
  on players for select
  using (true);

-- Anyone can insert players (done during round creation)
drop policy if exists "players_insert" on players;
create policy "players_insert"
  on players for insert
  with check (true);

-- Anyone can update a player row (submitting availability)
drop policy if exists "players_update" on players;
create policy "players_update"
  on players for update
  using (true);


-- ══════════════════════════════════════════════════════════════
-- REALTIME
--
-- Enable realtime on both tables so the ResultsPage gets
-- live updates when a player submits availability.
-- ══════════════════════════════════════════════════════════════
alter publication supabase_realtime add table rounds;
alter publication supabase_realtime add table players;


-- ══════════════════════════════════════════════════════════════
-- VERIFY
-- After running, you should see both tables in:
--   Table Editor → rounds, players
-- And both listed under:
--   Database → Publications → supabase_realtime
-- ══════════════════════════════════════════════════════════════
select
  table_name,
  (select count(*) from information_schema.columns c2 where c2.table_name = c.table_name) as column_count
from information_schema.tables c
where table_schema = 'public'
  and table_name in ('rounds', 'players')
order by table_name;
