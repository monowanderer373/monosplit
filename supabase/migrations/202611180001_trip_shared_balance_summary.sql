-- Share only the outstanding balance summary with active members of this Trip.
create or replace function public.read_trip_contra_snapshot(
 target_space_id uuid, rate_mode text default 'system', vnd_per_myr text default null, display_currency text default 'MYR'
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_variable
declare
 actor uuid := private.require_personal_actor();
 result jsonb;
 whole boolean;
 summary jsonb;
begin
 if private.space_role(target_space_id, actor) is null or not exists (
  select 1 from public.spaces s where s.id = target_space_id and s.type = 'trip' and s.status <> 'voided'
 ) then
  raise exception using message = 'space_membership_required', errcode = 'P0001';
 end if;

 result := private.contra_matrix(target_space_id, private.contra_quote(rate_mode, vnd_per_myr, display_currency));
 whole := private.creator_can_record(target_space_id, actor);

 select jsonb_build_object(
  'rows', coalesce(jsonb_agg(jsonb_build_object(
   'payer', d->'payer', 'recipient', d->'recipient', 'minor', d->'netMinor', 'estimated', d->'estimated'
  ) order by pair->>'id') filter (where (d->>'netMinor')::bigint > 0), '[]'::jsonb),
  'incomplete', coalesce(bool_or(not (d->>'known')::boolean), false)
 ) into summary
 from jsonb_array_elements(result->'pairs') as entries(pair)
 cross join lateral (select pair->'display' as d) as display
 where (pair->>'currentMembers')::boolean;

 if not whole then
  result := result || jsonb_build_object('pairs', (
   select coalesce(jsonb_agg(pair), '[]'::jsonb)
   from jsonb_array_elements(result->'pairs') as entries(pair)
   where actor::text in (pair->>'a', pair->>'b')
  ));
 end if;

 return result || jsonb_build_object('viewer', actor, 'canRecord', whole, 'tripBalances', summary);
end;
$$;
