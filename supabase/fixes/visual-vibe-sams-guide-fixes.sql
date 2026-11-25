-- Visual Vibe Design: two fixes after the Sam's Guide import (Angel, Nov 25). Run in Supabase → SQL Editor.
-- Visual Vibe's site id: 5c939f2631d6b31bdf4523e5d2f79a2c

-- ---- A. Matrix primaries get the Primary role (only where the keyword has no role yet) ------------------------
-- A1. Count first (expect 7: 8 primaries, "brand design rogers ar" is already Primary)
select k.keyword, k.role
from public.seo_keywords k
where k.role is null
  and k.id in (
    select mk.keyword_id
    from public.seo_matrix_keywords mk
    join public.seo_matrix_cells m on m.id = mk.cell_id
    join public.seo_clients c on c.id = m.client_id
    where mk.kind = 'primary' and c.site_id = '5c939f2631d6b31bdf4523e5d2f79a2c'
  )
order by k.keyword;

-- A2. Update (expected: UPDATE 7)
update public.seo_keywords k
set role = 'primary'
where k.role is null
  and k.id in (
    select mk.keyword_id
    from public.seo_matrix_keywords mk
    join public.seo_matrix_cells m on m.id = mk.cell_id
    join public.seo_clients c on c.id = m.client_id
    where mk.kind = 'primary' and c.site_id = '5c939f2631d6b31bdf4523e5d2f79a2c'
  );

-- ---- B. Imported pages: priority "not set yet" (needs migration 0012 first) ------------------------------------
-- B1. Count first (expect 9: all of Visual Vibe's pages came from the Sam's Guide import, all 'medium')
select p.name, p.priority
from public.seo_pages p
join public.seo_clients c on c.id = p.client_id
where c.site_id = '5c939f2631d6b31bdf4523e5d2f79a2c' and p.priority = 'medium'
order by p.name;

-- B2. Update (expected: UPDATE 9)
update public.seo_pages p
set priority = null
from public.seo_clients c
where c.id = p.client_id
  and c.site_id = '5c939f2631d6b31bdf4523e5d2f79a2c'
  and p.priority = 'medium';
