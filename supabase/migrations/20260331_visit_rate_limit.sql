create table if not exists public.visit_rate_limits (
  ip_key text primary key,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.visit_rate_limits enable row level security;
revoke all on table public.visit_rate_limits from anon, authenticated;

create or replace function public.consume_visit_rate_limit(
  p_ip_key text,
  p_limit integer default 30,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
  current_hits integer;
begin
  insert into public.visit_rate_limits (ip_key, window_start, hit_count, updated_at)
  values (p_ip_key, now_ts, 1, now_ts)
  on conflict (ip_key)
  do update
    set hit_count = case
        when public.visit_rate_limits.window_start <= now_ts - make_interval(secs => p_window_seconds) then 1
        else public.visit_rate_limits.hit_count + 1
      end,
      window_start = case
        when public.visit_rate_limits.window_start <= now_ts - make_interval(secs => p_window_seconds) then now_ts
        else public.visit_rate_limits.window_start
      end,
      updated_at = now_ts
  returning hit_count into current_hits;

  return current_hits <= p_limit;
end;
$$;

revoke all on function public.consume_visit_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_visit_rate_limit(text, integer, integer) to service_role;
