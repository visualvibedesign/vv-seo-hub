-- 0017 · GBP profile views breakdown (Nov 26): GBP › Performance splits "Profile views" into Google Search
-- (desktop / mobile) and Google Maps (desktop / mobile). Optional, typed in with the month's numbers.
-- Empty = unknown (never 0). Adds 4 nullable columns only: no rows change, nothing is deleted.
alter table public.seo_gbp_snapshots
  add column if not exists views_search_desktop integer check (views_search_desktop is null or views_search_desktop >= 0),
  add column if not exists views_search_mobile  integer check (views_search_mobile  is null or views_search_mobile  >= 0),
  add column if not exists views_maps_desktop   integer check (views_maps_desktop   is null or views_maps_desktop   >= 0),
  add column if not exists views_maps_mobile    integer check (views_maps_mobile    is null or views_maps_mobile    >= 0);
