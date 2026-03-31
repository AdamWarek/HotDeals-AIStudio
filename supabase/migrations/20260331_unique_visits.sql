-- Enable pgcrypto for SHA-256 hashing (idempotent, already enabled on Supabase by default)
create extension if not exists pgcrypto;

-- ============================================================
-- Dedup tables: record which visitor hashes have been counted
-- ============================================================

create table if not exists public.visit_uniques_daily (
  day_date date not null,
  visitor_hash text not null,
  is_bot boolean not null default false,
  primary key (day_date, visitor_hash)
);

create table if not exists public.visit_uniques_total (
  visitor_hash text primary key,
  is_bot boolean not null default false,
  first_seen_at timestamptz not null default now()
);

alter table public.visit_uniques_daily enable row level security;
alter table public.visit_uniques_total enable row level security;

revoke all on table public.visit_uniques_daily from anon, authenticated;
revoke all on table public.visit_uniques_total from anon, authenticated;

-- ============================================================
-- Extend existing counter tables with human/bot breakdown
-- ============================================================

alter table public.visits_daily
  add column if not exists human_count bigint not null default 0,
  add column if not exists bot_count bigint not null default 0;

alter table public.visits_total
  add column if not exists human_count bigint not null default 0,
  add column if not exists bot_count bigint not null default 0;

-- ============================================================
-- New RPC: track_unique_visit
-- Hashes visitor ID server-side, deduplicates per day and total,
-- increments human_count or bot_count only for new uniques.
-- Also increments raw visits_count unconditionally (backward compat).
-- ============================================================

create or replace function public.track_unique_visit(
  p_visitor_id text,
  p_is_bot boolean default false
)
returns table (
  daily_human bigint,
  daily_bot bigint,
  total_human bigint,
  total_bot bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_day date := current_date;
  v_hash text;
  is_new_daily boolean;
  is_new_total boolean;
begin
  v_hash := encode(extensions.digest(p_visitor_id::bytea, 'sha256'), 'hex');

  -- Attempt daily dedup insert; xmax = 0 means a real insert happened
  insert into public.visit_uniques_daily (day_date, visitor_hash, is_bot)
  values (current_day, v_hash, p_is_bot)
  on conflict (day_date, visitor_hash) do nothing;

  is_new_daily := found;

  -- Attempt total dedup insert
  insert into public.visit_uniques_total (visitor_hash, is_bot)
  values (v_hash, p_is_bot)
  on conflict (visitor_hash) do nothing;

  is_new_total := found;

  -- Always increment raw visits_count (backward compat hit counter)
  insert into public.visits_daily (day_date, visits_count)
  values (current_day, 1)
  on conflict (day_date)
  do update set visits_count = public.visits_daily.visits_count + 1;

  update public.visits_total
  set visits_count = visits_count + 1
  where id = 1;

  -- Increment unique human/bot counters only when new
  if is_new_daily then
    if p_is_bot then
      update public.visits_daily
      set bot_count = bot_count + 1
      where day_date = current_day;
    else
      update public.visits_daily
      set human_count = human_count + 1
      where day_date = current_day;
    end if;
  end if;

  if is_new_total then
    if p_is_bot then
      update public.visits_total
      set bot_count = bot_count + 1
      where id = 1;
    else
      update public.visits_total
      set human_count = human_count + 1
      where id = 1;
    end if;
  end if;

  return query
  select
    d.human_count as daily_human,
    d.bot_count as daily_bot,
    t.human_count as total_human,
    t.bot_count as total_bot
  from public.visits_daily d
  cross join public.visits_total t
  where d.day_date = current_day and t.id = 1;
end;
$$;

revoke all on function public.track_unique_visit(text, boolean) from public, anon, authenticated;
grant execute on function public.track_unique_visit(text, boolean) to service_role;

-- ============================================================
-- Drop old track_visit() to avoid drift
-- ============================================================

drop function if exists public.track_visit();
