-- Version history: earlier copies of online cities, to roll back to how a town looked before.
-- A copy is kept before a save at most every 30 minutes of building, and the last 20 per city are kept.

create table public.city_versions (
  id bigint generated always as identity primary key,
  city_id text not null references public.cities (id) on delete cascade,
  name text not null,
  data jsonb not null,
  saved_at timestamptz not null default now()
);
create index city_versions_by_city on public.city_versions (city_id, saved_at desc);

-- Only reachable through the functions below
revoke all on public.city_versions from anon, authenticated;
alter table public.city_versions enable row level security;

-- Keep a copy of a city before it changes (and only the newest 20)
create or replace function public.keep_version(town text, name text, data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.city_versions (city_id, name, data) values (town, name, data);
  delete from public.city_versions
  where city_id = town and id not in (select id from public.city_versions where city_id = town order by saved_at desc, id desc limit 20);
end;
$$;

create or replace function public.city_saved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.data is distinct from old.data) and not exists (select 1 from public.city_versions where city_id = old.id and saved_at > now() - interval '30 minutes') then
    perform public.keep_version(old.id, old.name, old.data);
  end if;
  return new;
end;
$$;

create trigger city_saved before update of data on public.cities
for each row execute function public.city_saved();

-- Earlier versions of a city (owner and builders only), newest first
create or replace function public.city_versions(town text)
returns table (id bigint, name text, saved_at timestamptz, size int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.cities c where c.id = town and (c.owner = auth.uid() or auth.uid() = any (c.editors))) then
    raise exception 'You can''t see the history of this city';
  end if;
  return query
    select v.id, v.name, v.saved_at, octet_length(v.data::text)
    from public.city_versions v
    where v.city_id = town
    order by v.saved_at desc, v.id desc;
end;
$$;

-- Bring a city back to an earlier version (the current one is kept first, so this can be undone the same way)
create or replace function public.restore_version(version bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.city_versions;
  c public.cities;
begin
  select * into v from public.city_versions where id = version;
  if not found then
    raise exception 'That version doesn''t exist anymore';
  end if;
  select * into c from public.cities where id = v.city_id;
  if not (c.owner = auth.uid() or auth.uid() = any (c.editors)) then
    raise exception 'You can''t change this city';
  end if;
  perform public.keep_version(c.id, c.name, c.data);
  update public.cities set
    data = v.data || jsonb_build_object('id', c.id),
    name = left(coalesce(v.data ->> 'name', v.name), 40),
    width = coalesce((v.data ->> 'width')::int, c.width),
    height = coalesce((v.data ->> 'height')::int, c.height)
  where id = c.id;
  return v.data || jsonb_build_object('id', c.id);
end;
$$;

revoke execute on function public.keep_version(text, text, jsonb), public.city_saved() from public, anon, authenticated;
grant execute on function public.city_versions(text), public.restore_version(bigint) to authenticated;
