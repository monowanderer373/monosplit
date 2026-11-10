-- Forward projection-only fix. The distributed 001 remains unchanged.
-- Opposite capacity orientations can carry the same original native pair.
-- Project each balance once from frozen original balances minus exact coverage,
-- including invalid drafts (whose original tentative remaining JSON may be null).
-- No draft, receipt, cash, coverage, expense or historical record is rewritten.
begin;
create or replace function private.routed_public_plan(plan jsonb)
returns jsonb language sql immutable set search_path='' as $$
 with native_balances as(
  select q->>'from' debtor,q->>'to' creditor,q->>'currency' currency,max((q->>'minor')::bigint) minor
  from jsonb_array_elements(plan->'sources')s cross join lateral jsonb_array_elements(s->'native')q group by 1,2,3
 ),reductions as(
  select q->>'from' debtor,q->>'to' creditor,q->>'currency' currency,sum((q->>'minor')::bigint)::bigint minor
  from jsonb_array_elements(plan->'native')q group by 1,2,3
 ),remaining as(
  select b.debtor,b.creditor,b.currency,b.minor-coalesce(r.minor,0) minor from native_balances b left join reductions r using(debtor,creditor,currency)
 )
 select(plan-'native'-'sources'-'actors')||jsonb_build_object(
  'coverage',(select coalesce(jsonb_agg(q-'edgeId'),'[]')from jsonb_array_elements(plan->'native')q),
  'remaining',(select coalesce(jsonb_agg(jsonb_build_object('id',r.debtor||':'||r.creditor||':'||r.currency,'from',r.debtor,'to',r.creditor,'currency',r.currency,'minor',r.minor)order by r.debtor,r.creditor,r.currency),'[]')from remaining r)
 )
$$;
revoke all on function private.routed_public_plan(jsonb)from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
