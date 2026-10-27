-- DreamMist database: profiles, cities, likes, trainer progress, uploads, and who can do what.
-- Run once in the Supabase SQL editor (or with `supabase db push`).

--====================================================================================================
-- Helpers

-- Short random id (lowercase letters and digits), used for city ids in share links and room invites
create or replace function public.short_id(length int default 10)
returns text
language sql
volatile
as $$
  select string_agg(substr('abcdefghijklmnopqrstuvwxyz0123456789', 1 + floor(random() * 36)::int, 1), '')
  from generate_series(1, length);
$$;

-- Keep updated_at current
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

--====================================================================================================
-- Profiles (one per account, created on sign up)

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_-]{3,20}$'),
  created_at timestamptz not null default now()
);

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (username) on public.profiles to authenticated;
alter table public.profiles enable row level security;
create policy "Profiles are public" on public.profiles for select using (true);
create policy "You can rename yourself" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Create a profile for every new account: the username asked at sign up, else the Google name or email
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1), 'trainer'), '[^a-zA-Z0-9_-]', '', 'g'));
  if length(base) < 3 then
    base := 'trainer';
  end if;
  base := left(base, 16);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

--====================================================================================================
-- Cities

create table public.cities (
  id text primary key default public.short_id(),
  owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null default 'New Town' check (char_length(name) <= 40),
  author text not null default '' check (char_length(author) <= 40),
  width int not null default 40,
  height int not null default 30,
  -- The whole city as saved by the editor (maps, people, story, interiors…)
  data jsonb not null check (octet_length(data::text) <= 4194304),
  -- Accounts allowed to build (joined with an invite link)
  editors uuid[] not null default '{}',
  invite text not null default public.short_id(12),
  published boolean not null default false,
  published_at timestamptz,
  description text not null default '' check (char_length(description) <= 500),
  thumb text not null default '',
  fork_of text references public.cities (id) on delete set null,
  plays int not null default 0,
  forks int not null default 0,
  likes int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cities_owner on public.cities (owner);
create index cities_published on public.cities (published, published_at desc);

create trigger cities_updated before update on public.cities for each row execute function public.touch_updated_at();

-- At most 50 cities per account
create or replace function public.limit_cities()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.cities where owner = new.owner) >= 50 then
    raise exception 'You can save up to 50 cities';
  end if;
  return new;
end;
$$;

create trigger cities_limit before insert on public.cities for each row execute function public.limit_cities();

-- Builders can save a city but only its owner publishes it, manages builders and invites
create or replace function public.protect_city()
returns trigger
language plpgsql
as $$
begin
  --Functions below that are allowed to (joining with an invite) mark the transaction as trusted
  if (auth.uid() is distinct from old.owner) and (coalesce(current_setting('dreammist.trusted', true), '') <> 'on') then
    new.published := old.published;
    new.published_at := old.published_at;
    new.description := old.description;
    new.thumb := old.thumb;
    new.editors := old.editors;
    new.invite := old.invite;
  end if;
  return new;
end;
$$;

create trigger cities_protect before update on public.cities for each row execute function public.protect_city();

alter table public.cities enable row level security;
-- Owners and builders see the full row (other people open cities through get_city and explore)
create policy "Owners and builders read" on public.cities for select using (owner = auth.uid() or auth.uid() = any (editors));
create policy "Create your own cities" on public.cities for insert with check (owner = auth.uid());
create policy "Owners and builders save" on public.cities for update using (owner = auth.uid() or auth.uid() = any (editors));
create policy "Owners delete" on public.cities for delete using (owner = auth.uid());

-- Clients never set ids, owners, credits or counters directly (the functions below do)
revoke all on public.cities from anon, authenticated;
grant select, delete on public.cities to authenticated;
grant insert (name, author, width, height, data) on public.cities to authenticated;
grant update (name, author, width, height, data, published, published_at, description, thumb, invite, editors) on public.cities to authenticated;

-- Likes (one per account and city)
create table public.likes (
  city_id text not null references public.cities (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (city_id, user_id)
);

revoke all on public.likes from anon, authenticated;
grant select on public.likes to authenticated;
alter table public.likes enable row level security;
create policy "See your likes" on public.likes for select using (user_id = auth.uid());

-- Public details of a city (what Explore and share links show)
create or replace function public.city_card(c public.cities)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'owner', (select username from public.profiles where id = c.owner),
    'author', c.author,
    'description', c.description,
    'thumb', c.thumb,
    'width', c.width,
    'height', c.height,
    'interiors', coalesce(jsonb_array_length(c.data -> 'interiors'), 0),
    'story', coalesce(jsonb_array_length(c.data -> 'story'), 0),
    'published', c.published,
    'publishedAt', (extract(epoch from c.published_at) * 1000)::bigint,
    'updated', (extract(epoch from c.updated_at) * 1000)::bigint,
    'plays', c.plays,
    'forks', c.forks,
    'likes', c.likes,
    'mine', c.owner = auth.uid(),
    'forkOf', (select jsonb_build_object('id', f.id, 'name', f.name, 'owner', (select username from public.profiles where id = f.owner)) from public.cities f where f.id = c.fork_of)
  );
$$;

-- Open a city from a share link: anyone with the id can play it, builders also get the invite
create or replace function public.get_city(city_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'city', c.data,
    'meta', public.city_card(c),
    'editable', (c.owner = auth.uid() or auth.uid() = any (c.editors)),
    'invite', case when c.owner = auth.uid() then c.invite end
  )
  from public.cities c
  where c.id = city_id;
$$;

-- Cities of the signed-in account (owned or joined as a builder)
create or replace function public.my_cities()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.city_card(c)
  from public.cities c
  where c.owner = auth.uid() or auth.uid() = any (c.editors)
  order by c.updated_at desc;
$$;

-- Published cities, newest first, with whether you liked them
create or replace function public.explore()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.city_card(c) || jsonb_build_object('liked', exists (select 1 from public.likes l where l.city_id = c.id and l.user_id = auth.uid()))
  from public.cities c
  where c.published
  order by c.published_at desc
  limit 500;
$$;

-- Save a city as its owner, a builder, or anyone holding its invite (guests in live rooms)
create or replace function public.save_city(city_id text, invite_code text, city jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.cities;
begin
  select * into c from public.cities where id = city_id;
  if not found then
    raise exception 'City not found';
  end if;
  if not (c.owner = auth.uid() or auth.uid() = any (c.editors) or (coalesce(invite_code, '') <> '' and invite_code = c.invite)) then
    raise exception 'You can''t edit this city';
  end if;
  update public.cities set
    data = city || jsonb_build_object('id', city_id),
    name = left(coalesce(city ->> 'name', c.name), 40),
    author = left(coalesce(city ->> 'author', ''), 40),
    width = coalesce((city ->> 'width')::int, c.width),
    height = coalesce((city ->> 'height')::int, c.height)
  where id = city_id
  returning * into c;
  return public.city_card(c);
end;
$$;

-- Join a city as a builder with its invite
create or replace function public.join_city(city_id text, invite_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  perform set_config('dreammist.trusted', 'on', true);
  update public.cities
    set editors = array_append(editors, auth.uid())
    where id = city_id and invite = invite_code and owner <> auth.uid() and not (auth.uid() = any (editors));
  return exists (select 1 from public.cities where id = city_id and (owner = auth.uid() or auth.uid() = any (editors)));
end;
$$;

-- New invite link (old links stop working for new builders)
create or replace function public.reset_invite(city_id text)
returns text
language sql
security definer
set search_path = public
as $$
  update public.cities set invite = public.short_id(12) where id = city_id and owner = auth.uid() returning invite;
$$;

-- Count a play of a published city
create or replace function public.count_play(city_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.cities set plays = plays + 1 where id = city_id and published;
$$;

-- Copy a city into your account, crediting the original
create or replace function public.fork_city(city_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  source public.cities;
  copy public.cities;
begin
  if auth.uid() is null then
    raise exception 'Log in to fork cities';
  end if;
  select * into source from public.cities where id = city_id;
  if not found then
    raise exception 'City not found';
  end if;
  insert into public.cities (owner, name, author, width, height, data, fork_of)
    values (auth.uid(), left(source.name, 40), (select username from public.profiles where id = auth.uid()), source.width, source.height, source.data, source.id)
    returning * into copy;
  update public.cities set data = data || jsonb_build_object('id', copy.id, 'author', copy.author) where id = copy.id returning * into copy;
  update public.cities set forks = forks + 1 where id = source.id;
  return public.city_card(copy) || jsonb_build_object('invite', copy.invite);
end;
$$;

--====================================================================================================
-- Likes

-- Like or unlike a published city
create or replace function public.toggle_like(city_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  liked boolean;
  total int;
begin
  if auth.uid() is null then
    raise exception 'Log in to like cities';
  end if;
  if not exists (select 1 from public.cities where id = city_id and published) then
    raise exception 'City not found';
  end if;
  delete from public.likes where likes.city_id = toggle_like.city_id and user_id = auth.uid();
  if found then
    liked := false;
  else
    insert into public.likes (city_id, user_id) values (toggle_like.city_id, auth.uid());
    liked := true;
  end if;
  update public.cities set likes = (select count(*) from public.likes where likes.city_id = toggle_like.city_id) where id = toggle_like.city_id returning likes into total;
  return jsonb_build_object('liked', liked, 'likes', total);
end;
$$;

--====================================================================================================
-- Trainer progress (party, badges, story progress: one per account)

create table public.trainers (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  data jsonb not null check (octet_length(data::text) <= 1048576),
  updated_at timestamptz not null default now()
);

create trigger trainers_updated before update on public.trainers for each row execute function public.touch_updated_at();

revoke all on public.trainers from anon, authenticated;
grant select, insert, update on public.trainers to authenticated;
alter table public.trainers enable row level security;
create policy "Read your trainer" on public.trainers for select using (user_id = auth.uid());
create policy "Create your trainer" on public.trainers for insert with check (user_id = auth.uid());
create policy "Save your trainer" on public.trainers for update using (user_id = auth.uid());

--====================================================================================================
-- Functions anyone can call (signed in or not) and those that need an account

grant execute on function public.get_city(text), public.explore(), public.count_play(text), public.save_city(text, text, jsonb) to anon, authenticated;
grant execute on function public.my_cities(), public.join_city(text, text), public.reset_invite(text), public.fork_city(text), public.toggle_like(text) to authenticated;

--====================================================================================================
-- Uploads (tilesets, sprites, music, Explore thumbnails), in a public bucket under each account's folder

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('assets', 'assets', true, 12582912, array['image/png', 'image/webp', 'image/gif', 'image/jpeg', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/aac'])
on conflict (id) do nothing;

create policy "Anyone can see uploads" on storage.objects for select using (bucket_id = 'assets');
create policy "Upload to your folder" on storage.objects for insert to authenticated with check (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Delete your uploads" on storage.objects for delete to authenticated using (bucket_id = 'assets' and (storage.foldername(name))[1] = auth.uid()::text);
