create function public.read_trip_final_statement(target_space_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
 actor uuid := private.require_personal_actor();
 agreed_rate text;
 snapshot jsonb;
 totals jsonb;
 people jsonb;
begin
 if private.space_role(target_space_id, actor) is null or not exists (
  select 1 from public.spaces where id = target_space_id and type = 'trip' and status <> 'voided'
 ) then
  raise exception using message = 'space_membership_required', errcode = 'P0001';
 end if;

 select draft->>'vndPerMyr' into agreed_rate
 from private.creator_records
 where space_id = target_space_id and status = 'posted' and draft->>'rateMode' = 'custom'
 order by recorded_at desc, id desc limit 1;

 snapshot := public.read_trip_contra_snapshot(
  target_space_id, case when agreed_rate is null then 'system' else 'custom' end, agreed_rate, 'MYR'
 );
 select coalesce(jsonb_agg(jsonb_build_object('currency', currency, 'minor', minor) order by currency), '[]'::jsonb)
 into totals from (
  select currency, sum(total_minor)::bigint minor from public.expenses
  where space_id = target_space_id and scope = 'space' and status = 'active' group by currency
 ) as amounts;

 select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name) order by p.id), '[]'::jsonb)
 into people from public.space_members m join public.participants p on p.id = m.participant_id
 where m.space_id = target_space_id and m.removed_at is null;

 return jsonb_build_object('snapshot', snapshot, 'totals', totals, 'people', people,
  'generatedAt', statement_timestamp(), 'rateBasis', case when agreed_rate is null then 'system' else 'latest_recorded_custom' end);
end;
$$;
revoke all on function public.read_trip_final_statement(uuid) from public, anon, authenticated;
grant execute on function public.read_trip_final_statement(uuid) to authenticated;
