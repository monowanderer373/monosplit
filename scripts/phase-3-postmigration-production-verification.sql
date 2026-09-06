-- Phase 3 post-migration production verification.
--
-- Safety contract:
--   * Run with a role that can SELECT the referenced public tables.
--   * The transaction is explicitly REPEATABLE READ and READ ONLY.
--   * Every analytical statement is SELECT-only.
--   * No RPC is called and no schema object is created or changed.
--   * Run psql with --set ON_ERROR_STOP=1 when using the CLI.
--
-- Empty invariant-detail result sets are expected. The final result set gives
-- one PASS/FAIL row per invariant plus an overall result.

begin transaction isolation level repeatable read read only;

-- 1. Established Friendships require exactly one active Person in each
-- direction.
with expected_direction as (
  select
    friendship.id as friendship_id,
    friendship.status as friendship_status,
    friendship.participant_low_id as owner_participant_id,
    friendship.participant_high_id as linked_participant_id,
    'low_to_high'::text as direction
  from public.friendships as friendship
  where friendship.status in ('accepted', 'archived', 'blocked')

  union all

  select
    friendship.id,
    friendship.status,
    friendship.participant_high_id,
    friendship.participant_low_id,
    'high_to_low'::text
  from public.friendships as friendship
  where friendship.status in ('accepted', 'archived', 'blocked')
)
select
  'established_friendship_direction'::text as report_section,
  expected.friendship_id,
  expected.friendship_status,
  expected.direction,
  expected.owner_participant_id,
  expected.linked_participant_id,
  count(person.id)::bigint as active_person_count
from expected_direction as expected
left join public.person_relationships as person
  on person.owner_participant_id = expected.owner_participant_id
 and person.linked_participant_id = expected.linked_participant_id
 and person.merged_into_person_id is null
group by
  expected.friendship_id,
  expected.friendship_status,
  expected.direction,
  expected.owner_participant_id,
  expected.linked_participant_id
having count(person.id) <> 1
order by expected.friendship_id, expected.direction;

-- 2. A currently pending Friendship must not have an active linked Person in
-- either direction.
with pending_direction as (
  select
    friendship.id as friendship_id,
    friendship.participant_low_id as owner_participant_id,
    friendship.participant_high_id as linked_participant_id,
    'low_to_high'::text as direction
  from public.friendships as friendship
  where friendship.status = 'pending'

  union all

  select
    friendship.id,
    friendship.participant_high_id,
    friendship.participant_low_id,
    'high_to_low'::text
  from public.friendships as friendship
  where friendship.status = 'pending'
)
select
  'pending_friendship_has_person'::text as report_section,
  pending.friendship_id,
  pending.direction,
  pending.owner_participant_id,
  pending.linked_participant_id,
  person.id as person_relationship_id
from pending_direction as pending
join public.person_relationships as person
  on person.owner_participant_id = pending.owner_participant_id
 and person.linked_participant_id = pending.linked_participant_id
 and person.merged_into_person_id is null
order by pending.friendship_id, pending.direction, person.id;

-- 3. Every valid owned Manual Participant must have exactly one Person
-- attachment.
with valid_owned_manual as (
  select
    manual.id as manual_participant_id,
    manual.created_by as owner_auth_user_id,
    owner.id as owner_participant_id
  from public.participants as manual
  join public.participants as owner
    on owner.auth_user_id = manual.created_by
   and owner.kind = 'account'
  where manual.kind = 'manual'
    and manual.created_by is not null
)
select
  'valid_manual_attachment_count'::text as report_section,
  manual.manual_participant_id,
  manual.owner_participant_id,
  count(attachment.manual_participant_id)::bigint as attachment_count
from valid_owned_manual as manual
left join public.person_manual_participants as attachment
  on attachment.manual_participant_id = manual.manual_participant_id
group by manual.manual_participant_id, manual.owner_participant_id
having count(attachment.manual_participant_id) <> 1
order by manual.manual_participant_id;

-- 4A. Every Person owner must exist and be an account Participant.
select
  'invalid_person_owner'::text as report_section,
  person.id as person_relationship_id,
  person.owner_participant_id,
  owner.kind as owner_kind,
  owner.auth_user_id as owner_auth_user_id
from public.person_relationships as person
left join public.participants as owner
  on owner.id = person.owner_participant_id
where owner.id is null
   or owner.kind is distinct from 'account'
order by person.id;

-- 4B. Every manual attachment must belong to an active Person owned by the
-- account Participant corresponding to the Manual Participant creator.
select
  'invalid_person_manual_owner_relationship'::text as report_section,
  attachment.person_id,
  attachment.manual_participant_id,
  person.owner_participant_id,
  person.merged_into_person_id,
  owner.kind as owner_kind,
  owner.auth_user_id as owner_auth_user_id,
  manual.kind as manual_kind,
  manual.auth_user_id as manual_auth_user_id,
  manual.created_by as manual_creator_auth_user_id
from public.person_manual_participants as attachment
left join public.person_relationships as person
  on person.id = attachment.person_id
left join public.participants as owner
  on owner.id = person.owner_participant_id
left join public.participants as manual
  on manual.id = attachment.manual_participant_id
where person.id is null
   or person.merged_into_person_id is not null
   or owner.id is null
   or owner.kind is distinct from 'account'
   or owner.auth_user_id is null
   or manual.id is null
   or manual.kind is distinct from 'manual'
   or manual.auth_user_id is not null
   or manual.created_by is distinct from owner.auth_user_id
order by attachment.person_id, attachment.manual_participant_id;

-- 5. Linked principals must be account Participants.
select
  'invalid_linked_participant_kind'::text as report_section,
  person.id as person_relationship_id,
  person.owner_participant_id,
  person.linked_participant_id,
  linked.kind as linked_kind,
  linked.auth_user_id as linked_auth_user_id
from public.person_relationships as person
left join public.participants as linked
  on linked.id = person.linked_participant_id
where person.linked_participant_id is not null
  and (
    linked.id is null
    or linked.kind is distinct from 'account'
  )
order by person.id;

-- 6. Attached principals must be Manual Participants.
select
  'invalid_manual_participant_kind'::text as report_section,
  attachment.person_id,
  attachment.manual_participant_id,
  manual.kind as manual_kind,
  manual.auth_user_id as manual_auth_user_id
from public.person_manual_participants as attachment
left join public.participants as manual
  on manual.id = attachment.manual_participant_id
where manual.id is null
   or manual.kind is distinct from 'manual'
   or manual.auth_user_id is not null
order by attachment.person_id, attachment.manual_participant_id;

-- 7. No active Person may map an owner to the same financial principal.
select
  'active_person_self_mapping'::text as report_section,
  person.id as person_relationship_id,
  person.owner_participant_id,
  person.linked_participant_id
from public.person_relationships as person
where person.merged_into_person_id is null
  and person.linked_participant_id = person.owner_participant_id
order by person.id;

-- 8. Every alias must merge into an active Person owned by the same account.
select
  'invalid_person_merge_target'::text as report_section,
  alias.id as alias_person_id,
  alias.owner_participant_id as alias_owner_participant_id,
  alias.merged_into_person_id,
  target.owner_participant_id as target_owner_participant_id,
  target.merged_into_person_id as target_merged_into_person_id
from public.person_relationships as alias
left join public.person_relationships as target
  on target.id = alias.merged_into_person_id
where alias.merged_into_person_id is not null
  and (
    target.id is null
    or target.owner_participant_id
      is distinct from alias.owner_participant_id
    or target.merged_into_person_id is not null
  )
order by alias.id;

-- 9. Every production link request must be bound to a Person. The column is
-- nullable for migration compatibility, but the clean pre-migration inventory
-- proved that Production had no legacy request rows to exempt.
select
  'link_request_missing_person_binding'::text as report_section,
  request.id as link_request_id,
  request.status,
  request.manual_participant_id,
  request.target_participant_id,
  request.requested_by,
  request.created_at
from public.participant_link_requests as request
where request.person_relationship_id is null
order by request.created_at, request.id;

-- 10. Current Person and Friendship counts. Person states are derived using
-- the same Phase 3 rules: Linked first, then Person-bound pending request,
-- otherwise Manual. Merged aliases are reported separately.
select
  count(*)::bigint as total_person_relationships,
  count(*) filter (
    where person.merged_into_person_id is null
      and person.linked_participant_id is not null
  )::bigint as linked_persons,
  count(*) filter (
    where person.merged_into_person_id is null
      and person.linked_participant_id is null
      and not exists (
        select 1
        from public.participant_link_requests as request
        where request.person_relationship_id = person.id
          and request.status = 'pending'
      )
  )::bigint as manual_persons,
  count(*) filter (
    where person.merged_into_person_id is null
      and person.linked_participant_id is null
      and exists (
        select 1
        from public.participant_link_requests as request
        where request.person_relationship_id = person.id
          and request.status = 'pending'
      )
  )::bigint as link_pending_persons,
  count(*) filter (
    where person.merged_into_person_id is not null
  )::bigint as merged_aliases,
  (
    select count(*)::bigint
    from public.person_manual_participants
  ) as manual_attachments,
  (
    select count(*)::bigint
    from public.friendships
    where status = 'accepted'
  ) as accepted_friendships,
  (
    select count(*)::bigint
    from public.friendships
    where status = 'archived'
  ) as archived_friendships,
  (
    select count(*)::bigint
    from public.friendships
    where status = 'blocked'
  ) as blocked_friendships,
  (
    select count(*)::bigint
    from public.friendships
    where status = 'pending'
  ) as pending_friendships
from public.person_relationships as person;

-- 11. Final PASS/FAIL result for each required invariant.
with
established_directions as (
  select
    friendship.id as friendship_id,
    friendship.participant_low_id as owner_participant_id,
    friendship.participant_high_id as linked_participant_id
  from public.friendships as friendship
  where friendship.status in ('accepted', 'archived', 'blocked')

  union all

  select
    friendship.id,
    friendship.participant_high_id,
    friendship.participant_low_id
  from public.friendships as friendship
  where friendship.status in ('accepted', 'archived', 'blocked')
),
established_direction_violations as (
  select expected.friendship_id, expected.owner_participant_id
  from established_directions as expected
  left join public.person_relationships as person
    on person.owner_participant_id = expected.owner_participant_id
   and person.linked_participant_id = expected.linked_participant_id
   and person.merged_into_person_id is null
  group by
    expected.friendship_id,
    expected.owner_participant_id,
    expected.linked_participant_id
  having count(person.id) <> 1
),
pending_directions as (
  select
    friendship.id as friendship_id,
    friendship.participant_low_id as owner_participant_id,
    friendship.participant_high_id as linked_participant_id
  from public.friendships as friendship
  where friendship.status = 'pending'

  union all

  select
    friendship.id,
    friendship.participant_high_id,
    friendship.participant_low_id
  from public.friendships as friendship
  where friendship.status = 'pending'
),
pending_friendship_violations as (
  select pending.friendship_id, person.id as person_relationship_id
  from pending_directions as pending
  join public.person_relationships as person
    on person.owner_participant_id = pending.owner_participant_id
   and person.linked_participant_id = pending.linked_participant_id
   and person.merged_into_person_id is null
),
valid_owned_manuals as (
  select
    manual.id as manual_participant_id,
    owner.id as owner_participant_id
  from public.participants as manual
  join public.participants as owner
    on owner.auth_user_id = manual.created_by
   and owner.kind = 'account'
  where manual.kind = 'manual'
    and manual.created_by is not null
),
valid_manual_attachment_violations as (
  select manual.manual_participant_id
  from valid_owned_manuals as manual
  left join public.person_manual_participants as attachment
    on attachment.manual_participant_id = manual.manual_participant_id
  group by manual.manual_participant_id
  having count(attachment.manual_participant_id) <> 1
),
invalid_person_owners as (
  select person.id
  from public.person_relationships as person
  left join public.participants as owner
    on owner.id = person.owner_participant_id
  where owner.id is null
     or owner.kind is distinct from 'account'
),
invalid_attachment_relationships as (
  select
    attachment.person_id,
    attachment.manual_participant_id
  from public.person_manual_participants as attachment
  left join public.person_relationships as person
    on person.id = attachment.person_id
  left join public.participants as owner
    on owner.id = person.owner_participant_id
  left join public.participants as manual
    on manual.id = attachment.manual_participant_id
  where person.id is null
     or person.merged_into_person_id is not null
     or owner.id is null
     or owner.kind is distinct from 'account'
     or owner.auth_user_id is null
     or manual.id is null
     or manual.kind is distinct from 'manual'
     or manual.auth_user_id is not null
     or manual.created_by is distinct from owner.auth_user_id
),
invalid_linked_kinds as (
  select person.id
  from public.person_relationships as person
  left join public.participants as linked
    on linked.id = person.linked_participant_id
  where person.linked_participant_id is not null
    and (
      linked.id is null
      or linked.kind is distinct from 'account'
    )
),
invalid_manual_kinds as (
  select
    attachment.person_id,
    attachment.manual_participant_id
  from public.person_manual_participants as attachment
  left join public.participants as manual
    on manual.id = attachment.manual_participant_id
  where manual.id is null
     or manual.kind is distinct from 'manual'
     or manual.auth_user_id is not null
),
self_mappings as (
  select person.id
  from public.person_relationships as person
  where person.merged_into_person_id is null
    and person.linked_participant_id = person.owner_participant_id
),
invalid_merge_targets as (
  select alias.id
  from public.person_relationships as alias
  left join public.person_relationships as target
    on target.id = alias.merged_into_person_id
  where alias.merged_into_person_id is not null
    and (
      target.id is null
      or target.owner_participant_id
        is distinct from alias.owner_participant_id
      or target.merged_into_person_id is not null
    )
),
unbound_link_requests as (
  select request.id
  from public.participant_link_requests as request
  where request.person_relationship_id is null
),
invariant_results as (
  select
    1 as invariant_number,
    'established friendships have two directional Persons'::text
      as invariant,
    (select count(*)::bigint from established_direction_violations)
      as violation_count

  union all

  select
    2,
    'pending friendships have no linked Persons',
    (select count(*)::bigint from pending_friendship_violations)

  union all

  select
    3,
    'valid owned Manual Participants have one attachment',
    (select count(*)::bigint from valid_manual_attachment_violations)

  union all

  select
    4,
    'Person owners and manual attachments have valid ownership',
    (
      (select count(*)::bigint from invalid_person_owners)
      +
      (select count(*)::bigint from invalid_attachment_relationships)
    )

  union all

  select
    5,
    'linked Participant principals are accounts',
    (select count(*)::bigint from invalid_linked_kinds)

  union all

  select
    6,
    'attached Participant principals are manual',
    (select count(*)::bigint from invalid_manual_kinds)

  union all

  select
    7,
    'active Persons do not map owners to themselves',
    (select count(*)::bigint from self_mappings)

  union all

  select
    8,
    'merged aliases target active Persons with the same owner',
    (select count(*)::bigint from invalid_merge_targets)

  union all

  select
    9,
    'all link requests are bound to Persons',
    (select count(*)::bigint from unbound_link_requests)
),
final_results as (
  select
    invariant_number,
    invariant,
    violation_count,
    case
      when violation_count = 0 then 'PASS'
      else 'FAIL'
    end::text as result
  from invariant_results

  union all

  select
    10,
    'overall',
    sum(violation_count)::bigint,
    case
      when bool_and(violation_count = 0) then 'PASS'
      else 'FAIL'
    end::text
  from invariant_results
)
select
  invariant_number,
  invariant,
  violation_count,
  result
from final_results
order by invariant_number;

rollback;
