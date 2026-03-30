create table if not exists public.visits_daily (
  day_date date primary key,
  visits_count bigint not null default 0
);

create table if not exists public.visits_total (
  id integer primary key check (id = 1),
  visits_count bigint not null default 0
);

insert into public.visits_total (id, visits_count)
values (1, 0)
on conflict (id) do nothing;

alter table public.visits_daily enable row level security;
alter table public.visits_total enable row level security;

revoke all on table public.visits_daily from anon, authenticated;
revoke all on table public.visits_total from anon, authenticated;

create or replace function public.track_visit()
returns table (
  daily_visits bigint,
  total_visits bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_day date := current_date;
begin
  insert into public.visits_daily (day_date, visits_count)
  values (current_day, 1)
  on conflict (day_date)
  do update set visits_count = public.visits_daily.visits_count + 1;

  update public.visits_total
  set visits_count = visits_count + 1
  where id = 1;

  return query
  select d.visits_count as daily_visits, t.visits_count as total_visits
  from public.visits_daily d
  cross join public.visits_total t
  where d.day_date = current_day and t.id = 1;
end;
$$;

revoke all on function public.track_visit() from public, anon, authenticated;
grant execute on function public.track_visit() to service_role;
