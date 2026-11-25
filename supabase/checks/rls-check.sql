-- Read-only check: every seo_ table has row level security ON and NO policies (server-only access).
-- Run in Supabase → SQL Editor. It changes nothing. Expected: rls_on = true and policies = 0 on every row.
select
  c.relname                                   as table_name,
  c.relrowsecurity                            as rls_on,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname like 'seo\_%'
order by 1;
