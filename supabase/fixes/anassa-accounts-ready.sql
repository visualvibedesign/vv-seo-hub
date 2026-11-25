-- Set all of Anassa's accounts to Ready (Angel, Nov 25). Run in Supabase → SQL Editor.
-- 1. Count first (expect 12 rows, all 'pending', no next steps or notes):
select a.kind, a.status, a.next_action, a.note
from public.seo_client_accounts a
join public.seo_clients c on c.id = a.client_id
where c.site_id = 'c6e74adc272c98005f3086f85c88b9da'
order by a.kind;

-- 2. Then the update (changes the 12 pending rows; anything already Ready or N/A is left alone):
update public.seo_client_accounts a
set status = 'ready', updated_at = now()
from public.seo_clients c
where c.id = a.client_id
  and c.site_id = 'c6e74adc272c98005f3086f85c88b9da'
  and a.status = 'pending';
-- Expected: UPDATE 12
