-- 0018 · Save baseline in one step (Nov 27, phase 2e). DRAFT: Angel runs it in the SQL Editor after review.
-- Adds one function + one index. No table changes, no rows changed, nothing deleted.
--
-- Why a function: "Start a new baseline" = mark the old one not-current + insert the new one + its values.
-- Done as separate API calls, a failure halfway could leave a client with no current baseline. In one function
-- it is one transaction: all or nothing.
--
-- Modes:
--   'new'  : the current baseline (if any) becomes history; a new current one is saved with p_values.
--   'fill' : adds only the sources the current baseline is MISSING (e.g. GBP typed in after Day 3).
--            A source already saved is never overwritten.
-- Values are worked out by the server from SEO Hub's own tables (never typed by the browser).

create or replace function public.seo_save_baseline(
  p_client_id uuid,
  p_mode      text,
  p_label     text,
  p_note      text,
  p_values    jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_mode = 'new' then
    update public.seo_baselines set is_current = false where client_id = p_client_id and is_current;
    insert into public.seo_baselines (client_id, label, note) values (p_client_id, p_label, p_note) returning id into v_id;
  elsif p_mode = 'fill' then
    select id into v_id from public.seo_baselines where client_id = p_client_id and is_current for update;
    if v_id is null then
      raise exception 'No current baseline to fill';
    end if;
  else
    raise exception 'Unknown mode %', p_mode;
  end if;

  insert into public.seo_baseline_values (baseline_id, source, metric, value, value_text, date_from, date_to)
  select v_id, x.source, x.metric, x.value, x.value_text, x.date_from, x.date_to
  from jsonb_to_recordset(coalesce(p_values, '[]'::jsonb))
       as x(source text, metric text, value numeric, value_text text, date_from date, date_to date)
  where not exists (
    select 1 from public.seo_baseline_values b where b.baseline_id = v_id and b.source = x.source
  );

  return v_id;
end;
$$;

-- Only the server (service key) may call it: never the browser's anon / signed-in roles.
revoke all on function public.seo_save_baseline(uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.seo_save_baseline(uuid, text, text, text, jsonb) to service_role;

-- Baseline history per client, newest first.
create index if not exists seo_baselines_client_saved on public.seo_baselines (client_id, saved_at desc);
