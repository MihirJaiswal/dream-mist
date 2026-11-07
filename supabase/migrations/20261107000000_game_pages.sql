-- Game pages (/g/{id}, /play/{id}): a city's card without its whole map, for anyone with the link
-- (get_city returns the full city, too heavy to render a page or a link preview)
create or replace function public.city_card_of(city_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.city_card(c) || jsonb_build_object('liked', exists (select 1 from public.likes l where l.city_id = c.id and l.user_id = auth.uid()))
  from public.cities c
  where c.id = city_id;
$$;

grant execute on function public.city_card_of(text) to anon, authenticated;
