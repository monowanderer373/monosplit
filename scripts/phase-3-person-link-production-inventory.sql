-- Phase 3 Person/link production inventory.
--
-- Safety contract:
--   * Run with a role that can SELECT public and auth data.
--   * The transaction is explicitly READ ONLY.
--   * Every analytical statement below is SELECT-only.
--   * No RPC is called and no schema object is created.
--
-- Results contain production identifiers. Store exports only in the approved
-- encrypted release-evidence location; do not commit result data.

begin transaction isolation level repeatable read read only;

-- 1A. Link-request totals by status.
select
  'link_request_status_summary'::text as report_section,
  request.status,
  count(*)::bigint as request_count
from public.participant_link_requests as request
group by request.status
order by request.status;

-- 1B. Link-request detail and identity validity.
select
  'link_request_detail'::text as report_section,
  request.id as link_request_id,
  request.status,
  request.created_at,
  request.responded_at,
  request.manual_participant_id,
  manual.display_name as manual_display_name,
  manual.kind as manual_kind,
  manual.created_by as manual_creator_auth_user_id,
  request.target_participant_id,
  target.display_name as target_display_name,
  target.kind as target_kind,
  target.auth_user_id as target_auth_user_id,
  request.requested_by as requester_participant_id,
  requester.display_name as requester_display_name,
  requester.auth_user_id as requester_auth_user_id,
  (manual.id is not null and manual.kind = 'manual') as manual_is_valid,
  (
    target.id is not null
    and target.kind = 'account'
    and target.auth_user_id is not null
  ) as target_is_live_account,
  (
    requester.id is not null
    and requester.kind = 'account'
    and requester.auth_user_id is not null
  ) as requester_is_live_account
from public.participant_link_requests as request
left join public.participants as manual
  on manual.id = request.manual_participant_id
left join public.participants as target
  on target.id = request.target_participant_id
left join public.participants as requester
  on requester.id = request.requested_by
order by request.created_at, request.id;

-- 2. Historical manual-link event detail. participation_match_count must be
-- exactly one for safe reconstruction from the current row shape.
with raw_link_events as (
  select
    event.id as link_event_id,
    event.created_at as linked_at,
    event.expense_id,
    event.safe_diff,
    event.safe_diff ->> 'manual_participant_id' as old_participant_text,
    event.safe_diff ->> 'participant_id' as new_participant_text
  from public.financial_events as event
  where event.event_type = 'expense.manual_participant_linked'
),
link_events as (
  select
    raw.*,
    case
      when raw.old_participant_text ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then raw.old_participant_text::uuid
    end as old_manual_participant_id,
    case
      when raw.new_participant_text ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then raw.new_participant_text::uuid
    end as new_account_participant_id
  from raw_link_events as raw
)
select
  'manual_link_event_detail'::text as report_section,
  link.link_event_id,
  link.linked_at,
  link.expense_id,
  expense.scope,
  expense.space_id,
  expense.currency,
  expense.status as expense_status,
  expense.version as expense_version,
  link.old_participant_text,
  link.old_manual_participant_id,
  old_participant.display_name as old_manual_display_name,
  old_participant.kind as old_participant_kind,
  link.new_participant_text,
  link.new_account_participant_id,
  new_participant.display_name as new_account_display_name,
  new_participant.kind as new_participant_kind,
  participation_matches.participation_match_count,
  participation_matches.participation_ids,
  participation_matches.current_participant_ids,
  participation_matches.current_states,
  participation_matches.current_tracking_modes,
  participation_matches.current_name_snapshots
from link_events as link
left join public.expenses as expense on expense.id = link.expense_id
left join public.participants as old_participant
  on old_participant.id = link.old_manual_participant_id
left join public.participants as new_participant
  on new_participant.id = link.new_account_participant_id
left join lateral (
  select
    count(*)::bigint as participation_match_count,
    array_agg(participation.id order by participation.id) as participation_ids,
    array_agg(participation.participant_id order by participation.id)
      as current_participant_ids,
    array_agg(participation.state order by participation.id) as current_states,
    array_agg(participation.tracking_mode order by participation.id)
      as current_tracking_modes,
    array_agg(participation.name_snapshot order by participation.id)
      as current_name_snapshots
  from public.expense_participations as participation
  where participation.expense_id = link.expense_id
    and participation.participant_id in (
      link.old_manual_participant_id,
      link.new_account_participant_id
    )
) as participation_matches on true
order by link.linked_at, link.link_event_id;

-- 3. More than one accepted Manual Participant linked to the same target by
-- the same owner/requester.
select
  'multiple_manuals_same_owner_target'::text as report_section,
  request.requested_by as owner_participant_id,
  request.target_participant_id,
  count(distinct request.manual_participant_id)::bigint
    as linked_manual_count,
  array_agg(
    distinct request.manual_participant_id
    order by request.manual_participant_id
  ) as manual_participant_ids,
  array_agg(request.id order by request.created_at, request.id)
    as link_request_ids
from public.participant_link_requests as request
where request.status = 'accepted'
group by request.requested_by, request.target_participant_id
having count(distinct request.manual_participant_id) > 1
order by request.requested_by, request.target_participant_id;

-- 4. Manual records whose owner/requester also has an accepted Friendship
-- with the selected account target.
select
  'manual_and_accepted_friend_coexistence'::text as report_section,
  request.id as link_request_id,
  request.status as link_status,
  request.manual_participant_id,
  manual.display_name as manual_display_name,
  request.requested_by as owner_participant_id,
  request.target_participant_id,
  target.display_name as target_display_name,
  friendship.id as friendship_id,
  friendship.status as friendship_status,
  friendship.accepted_at
from public.participant_link_requests as request
join public.participants as manual
  on manual.id = request.manual_participant_id
join public.participants as target
  on target.id = request.target_participant_id
join public.friendships as friendship
  on friendship.participant_low_id =
      least(request.requested_by, request.target_participant_id)
 and friendship.participant_high_id =
      greatest(request.requested_by, request.target_participant_id)
 and friendship.status = 'accepted'
order by request.requested_by, request.target_participant_id, request.created_at;

-- 5. Manual and linked-account membership rows in the same Space.
select
  'manual_and_account_same_space'::text as report_section,
  request.id as link_request_id,
  request.status as link_status,
  manual_member.space_id,
  space.name as space_name,
  space.type as space_type,
  request.manual_participant_id,
  manual_member.role as manual_role,
  manual_member.removed_at as manual_removed_at,
  request.target_participant_id,
  account_member.role as account_role,
  account_member.removed_at as account_removed_at,
  (
    manual_member.removed_at is null
    and account_member.removed_at is null
  ) as both_currently_active
from public.participant_link_requests as request
join public.space_members as manual_member
  on manual_member.participant_id = request.manual_participant_id
join public.space_members as account_member
  on account_member.space_id = manual_member.space_id
 and account_member.participant_id = request.target_participant_id
join public.spaces as space on space.id = manual_member.space_id
where request.status in ('pending', 'accepted')
order by manual_member.space_id, request.id;

-- 6 and 12. Classify every historical link event by later trust, financial,
-- settlement, metadata, void, and unexplained participation mutations.
with raw_link_events as (
  select
    event.id as link_event_id,
    event.created_at as linked_at,
    event.expense_id,
    event.safe_diff ->> 'manual_participant_id' as old_participant_text,
    event.safe_diff ->> 'participant_id' as new_participant_text
  from public.financial_events as event
  where event.event_type = 'expense.manual_participant_linked'
),
link_events as (
  select
    raw.*,
    case
      when raw.old_participant_text ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then raw.old_participant_text::uuid
    end as old_manual_participant_id,
    case
      when raw.new_participant_text ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then raw.new_participant_text::uuid
    end as new_account_participant_id
  from raw_link_events as raw
),
interactions as (
  select
    link.*,
    expense.scope,
    expense.space_id,
    expense.currency,
    expense.status as expense_status,
    matches.participation_match_count,
    matches.participation_ids,
    matches.current_participant_ids,
    matches.current_states,
    matches.current_tracking_modes,
    matches.latest_participation_update,
    coalesce(later.direct_response_count, 0) as later_direct_response_count,
    coalesce(later.financial_replace_count, 0) as later_financial_replace_count,
    coalesce(later.metadata_edit_count, 0) as later_metadata_edit_count,
    coalesce(later.void_count, 0) as later_void_count,
    coalesce(settlements.settlement_candidate_count, 0)
      as settlement_candidate_count,
    coalesce(settlements.accepted_allocation_count, 0)
      as accepted_allocation_count,
    case
      when expense.id is null
        or link.old_manual_participant_id is null
        or link.new_account_participant_id is null
        or matches.participation_match_count <> 1
        or coalesce(later.financial_replace_count, 0) > 0
        or (
          matches.latest_participation_update > link.linked_at
          and coalesce(later.direct_response_count, 0) = 0
        )
        then 'UNRECONSTRUCTABLE'
      when coalesce(later.direct_response_count, 0) > 0
        or coalesce(later.metadata_edit_count, 0) > 0
        or coalesce(later.void_count, 0) > 0
        or coalesce(settlements.settlement_candidate_count, 0) > 0
        then 'REQUIRES-REVIEW'
      else 'SAFE-CANDIDATE'
    end as risk_bucket
  from link_events as link
  left join public.expenses as expense on expense.id = link.expense_id
  left join lateral (
    select
      count(*)::bigint as participation_match_count,
      array_agg(participation.id order by participation.id)
        as participation_ids,
      array_agg(participation.participant_id order by participation.id)
        as current_participant_ids,
      array_agg(participation.state order by participation.id)
        as current_states,
      array_agg(participation.tracking_mode order by participation.id)
        as current_tracking_modes,
      max(participation.updated_at) as latest_participation_update
    from public.expense_participations as participation
    where participation.expense_id = link.expense_id
      and participation.participant_id in (
        link.old_manual_participant_id,
        link.new_account_participant_id
      )
  ) as matches on true
  left join lateral (
    select
      count(*) filter (
        where event.event_type in ('direct.accepted', 'direct.declined')
          and event.actor_participant_id = link.new_account_participant_id
      )::bigint as direct_response_count,
      count(*) filter (
        where event.event_type = 'expense.financials_replaced'
      )::bigint as financial_replace_count,
      count(*) filter (
        where event.event_type = 'expense.metadata_updated'
      )::bigint as metadata_edit_count,
      count(*) filter (
        where event.event_type = 'expense.voided'
      )::bigint as void_count
    from public.financial_events as event
    where event.expense_id = link.expense_id
      and event.created_at > link.linked_at
  ) as later on true
  left join lateral (
    select
      count(distinct payment.id)::bigint as settlement_candidate_count,
      count(distinct allocation.id) filter (
        where allocation.state = 'accepted'
      )::bigint as accepted_allocation_count
    from public.settlement_payments as payment
    join public.settlement_allocations as allocation
      on allocation.settlement_payment_id = payment.id
    where expense.id is not null
      and payment.currency = expense.currency
      and payment.scope = expense.scope
      and payment.space_id is not distinct from expense.space_id
      and (
        (
          payment.debtor_participant_id = link.new_account_participant_id
          and exists (
            select 1
            from public.expense_participations as counterpart
            where counterpart.expense_id = link.expense_id
              and counterpart.participant_id =
                allocation.creditor_participant_id
              and counterpart.participant_id <>
                link.new_account_participant_id
          )
        )
        or (
          allocation.creditor_participant_id =
            link.new_account_participant_id
          and exists (
            select 1
            from public.expense_participations as counterpart
            where counterpart.expense_id = link.expense_id
              and counterpart.participant_id =
                payment.debtor_participant_id
              and counterpart.participant_id <>
                link.new_account_participant_id
          )
        )
      )
  ) as settlements on true
)
select
  'historical_link_interaction_classification'::text as report_section,
  risk_bucket,
  link_event_id,
  linked_at,
  expense_id,
  scope,
  space_id,
  currency,
  expense_status,
  old_manual_participant_id,
  new_account_participant_id,
  participation_match_count,
  participation_ids,
  current_participant_ids,
  current_states,
  current_tracking_modes,
  latest_participation_update,
  later_direct_response_count,
  later_financial_replace_count,
  later_metadata_edit_count,
  later_void_count,
  settlement_candidate_count,
  accepted_allocation_count
from interactions
order by
  case risk_bucket
    when 'UNRECONSTRUCTABLE' then 1
    when 'REQUIRES-REVIEW' then 2
    else 3
  end,
  linked_at,
  link_event_id;

-- 7. Events for which the expected original participation cannot be safely
-- reconstructed from event payload plus current rows.
with raw_link_events as (
  select
    event.id as link_event_id,
    event.created_at as linked_at,
    event.expense_id,
    event.safe_diff ->> 'manual_participant_id' as old_participant_text,
    event.safe_diff ->> 'participant_id' as new_participant_text
  from public.financial_events as event
  where event.event_type = 'expense.manual_participant_linked'
),
checked as (
  select
    raw.*,
    case
      when raw.old_participant_text ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then raw.old_participant_text::uuid
    end as old_manual_participant_id,
    case
      when raw.new_participant_text ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then raw.new_participant_text::uuid
    end as new_account_participant_id
  from raw_link_events as raw
),
reconstruction as (
  select
    checked.*,
    expense.id is not null as expense_exists,
    (
      select count(*)::bigint
      from public.expense_participations as participation
      where participation.expense_id = checked.expense_id
        and participation.participant_id in (
          checked.old_manual_participant_id,
          checked.new_account_participant_id
        )
    ) as participation_match_count,
    exists (
      select 1
      from public.financial_events as event
      where event.expense_id = checked.expense_id
        and event.event_type = 'expense.financials_replaced'
        and event.created_at > checked.linked_at
    ) as later_financial_replace
  from checked
  left join public.expenses as expense on expense.id = checked.expense_id
)
select
  'unreconstructable_link_event'::text as report_section,
  link_event_id,
  linked_at,
  expense_id,
  old_participant_text,
  new_participant_text,
  expense_exists,
  participation_match_count,
  later_financial_replace,
  concat_ws(
    '; ',
    case when old_manual_participant_id is null
      then 'missing_or_malformed_old_participant_id' end,
    case when new_account_participant_id is null
      then 'missing_or_malformed_new_participant_id' end,
    case when not expense_exists then 'missing_expense' end,
    case when participation_match_count <> 1
      then 'current_participation_not_unique' end,
    case when later_financial_replace
      then 'later_financial_replacement_destroyed_original_shape' end
  ) as reconstruction_failure_reason
from reconstruction
where old_manual_participant_id is null
   or new_account_participant_id is null
   or not expense_exists
   or participation_match_count <> 1
   or later_financial_replace
order by linked_at, link_event_id;

-- 8. Orphan or malformed manual/link identities.
with malformed_events as (
  select
    event.id,
    event.expense_id,
    event.safe_diff ->> 'manual_participant_id' as manual_text,
    event.safe_diff ->> 'participant_id' as target_text
  from public.financial_events as event
  where event.event_type = 'expense.manual_participant_linked'
    and (
      coalesce(event.safe_diff ->> 'manual_participant_id', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(event.safe_diff ->> 'participant_id', '') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or event.expense_id is null
    )
)
select
  'orphan_identity'::text as report_section,
  'manual_missing_creator'::text as orphan_type,
  manual.id as manual_participant_id,
  null::uuid as target_participant_id,
  manual.created_by as related_auth_user_id,
  null::uuid as reference_id,
  manual.display_name as details
from public.participants as manual
left join auth.users as creator on creator.id = manual.created_by
where manual.kind = 'manual'
  and (manual.created_by is null or creator.id is null)

union all

select
  'orphan_identity',
  'manual_without_linkable_owner',
  manual.id,
  null::uuid,
  manual.created_by,
  null::uuid,
  manual.display_name
from public.participants as manual
left join public.participants as owner
  on owner.auth_user_id = manual.created_by
 and owner.kind = 'account'
where manual.kind = 'manual'
  and owner.id is null

union all

select
  'orphan_identity',
  'target_account_auth_user_missing',
  request.manual_participant_id,
  request.target_participant_id,
  target.auth_user_id,
  request.id,
  target.display_name
from public.participant_link_requests as request
join public.participants as target
  on target.id = request.target_participant_id
left join auth.users as target_user on target_user.id = target.auth_user_id
where target.kind <> 'account'
   or target.auth_user_id is null
   or target_user.id is null

union all

select
  'orphan_identity',
  'malformed_manual_link_event',
  null::uuid,
  null::uuid,
  null::uuid,
  malformed.id,
  concat_ws(
    ', ',
    'expense=' || coalesce(malformed.expense_id::text, 'null'),
    'manual=' || coalesce(malformed.manual_text, 'null'),
    'target=' || coalesce(malformed.target_text, 'null')
  )
from malformed_events as malformed
order by orphan_type, manual_participant_id, reference_id;

-- 9. Current gross positions that may be assigned to an account because of a
-- historical manual-link rewrite. This is not a full net-balance calculation;
-- it identifies the precise expense positions that require comparison.
with link_events as (
  select
    event.id as link_event_id,
    event.created_at as linked_at,
    event.expense_id,
    case
      when event.safe_diff ->> 'participant_id' ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (event.safe_diff ->> 'participant_id')::uuid
    end as new_account_participant_id
  from public.financial_events as event
  where event.event_type = 'expense.manual_participant_linked'
)
select
  'potentially_affected_current_position'::text as report_section,
  link.link_event_id,
  link.linked_at,
  expense.id as expense_id,
  expense.scope,
  expense.space_id,
  expense.currency,
  expense.status as expense_status,
  participation.id as participation_id,
  participation.participant_id as account_participant_id,
  participation.state,
  participation.tracking_mode,
  coalesce(contribution.amount_minor, 0) as paid_minor,
  share.amount_minor as share_minor,
  coalesce(contribution.amount_minor, 0) - share.amount_minor
    as gross_position_minor,
  (
    expense.status = 'active'
    and (
      expense.scope = 'space'
      or (
        expense.scope = 'direct'
        and participation.state = 'accepted'
        and participation.tracking_mode = 'tracked'
      )
    )
  ) as currently_balance_relevant
from link_events as link
join public.expenses as expense on expense.id = link.expense_id
join public.expense_participations as participation
  on participation.expense_id = expense.id
 and participation.participant_id = link.new_account_participant_id
join public.expense_shares as share
  on share.expense_participation_id = participation.id
left join public.payer_contributions as contribution
  on contribution.expense_participation_id = participation.id
where coalesce(contribution.amount_minor, 0) <> share.amount_minor
order by expense.scope, expense.space_id, expense.id, participation.id;

-- 10. Space positions currently contributing under the linked account ID.
with link_events as (
  select
    event.id as link_event_id,
    event.created_at as linked_at,
    event.expense_id,
    case
      when event.safe_diff ->> 'manual_participant_id' ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (event.safe_diff ->> 'manual_participant_id')::uuid
    end as old_manual_participant_id,
    case
      when event.safe_diff ->> 'participant_id' ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (event.safe_diff ->> 'participant_id')::uuid
    end as new_account_participant_id
  from public.financial_events as event
  where event.event_type = 'expense.manual_participant_linked'
)
select
  'space_history_current_account_balance'::text as report_section,
  link.link_event_id,
  link.linked_at,
  expense.id as expense_id,
  expense.space_id,
  space.name as space_name,
  space.type as space_type,
  expense.currency,
  link.old_manual_participant_id,
  link.new_account_participant_id,
  participation.id as participation_id,
  participation.state,
  participation.tracking_mode,
  coalesce(contribution.amount_minor, 0) as paid_minor,
  share.amount_minor as share_minor,
  coalesce(contribution.amount_minor, 0) - share.amount_minor
    as gross_position_minor
from link_events as link
join public.expenses as expense
  on expense.id = link.expense_id
 and expense.scope = 'space'
 and expense.status = 'active'
join public.spaces as space on space.id = expense.space_id
join public.expense_participations as participation
  on participation.expense_id = expense.id
 and participation.participant_id = link.new_account_participant_id
join public.expense_shares as share
  on share.expense_participation_id = participation.id
left join public.payer_contributions as contribution
  on contribution.expense_participation_id = participation.id
where coalesce(contribution.amount_minor, 0) <> share.amount_minor
order by expense.space_id, expense.id, participation.id;

-- 11. Settlements in the same context/currency and account/counterparty pair
-- whose FIFO application could differ after historical identity reassignment.
with link_events as (
  select
    event.id as link_event_id,
    event.created_at as linked_at,
    event.expense_id,
    case
      when event.safe_diff ->> 'manual_participant_id' ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (event.safe_diff ->> 'manual_participant_id')::uuid
    end as old_manual_participant_id,
    case
      when event.safe_diff ->> 'participant_id' ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (event.safe_diff ->> 'participant_id')::uuid
    end as new_account_participant_id
  from public.financial_events as event
  where event.event_type = 'expense.manual_participant_linked'
)
select distinct
  'settlement_application_candidate'::text as report_section,
  link.link_event_id,
  link.linked_at,
  expense.id as expense_id,
  expense.scope as expense_scope,
  expense.space_id,
  expense.currency,
  link.old_manual_participant_id,
  link.new_account_participant_id,
  payment.id as settlement_payment_id,
  payment.created_at as settlement_created_at,
  payment.payment_date,
  payment.status as settlement_status,
  payment.debtor_participant_id,
  allocation.id as settlement_allocation_id,
  allocation.creditor_participant_id,
  allocation.amount_minor,
  allocation.state as allocation_state,
  allocation.responded_at,
  (allocation.state = 'accepted') as currently_applies_to_balance
from link_events as link
join public.expenses as expense on expense.id = link.expense_id
join public.settlement_payments as payment
  on payment.currency = expense.currency
 and payment.scope = expense.scope
 and payment.space_id is not distinct from expense.space_id
join public.settlement_allocations as allocation
  on allocation.settlement_payment_id = payment.id
where (
    payment.debtor_participant_id = link.new_account_participant_id
    and exists (
      select 1
      from public.expense_participations as counterpart
      where counterpart.expense_id = link.expense_id
        and counterpart.participant_id = allocation.creditor_participant_id
        and counterpart.participant_id <> link.new_account_participant_id
    )
  )
  or (
    allocation.creditor_participant_id = link.new_account_participant_id
    and exists (
      select 1
      from public.expense_participations as counterpart
      where counterpart.expense_id = link.expense_id
        and counterpart.participant_id = payment.debtor_participant_id
        and counterpart.participant_id <> link.new_account_participant_id
    )
  )
order by link.link_event_id, payment.payment_date, payment.id, allocation.id;

-- 12. Bucket totals. This intentionally repeats the conservative core
-- classification so the export has a concise release-gate summary.
with raw_link_events as (
  select
    event.id as link_event_id,
    event.created_at as linked_at,
    event.expense_id,
    case
      when event.safe_diff ->> 'manual_participant_id' ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (event.safe_diff ->> 'manual_participant_id')::uuid
    end as old_manual_participant_id,
    case
      when event.safe_diff ->> 'participant_id' ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (event.safe_diff ->> 'participant_id')::uuid
    end as new_account_participant_id
  from public.financial_events as event
  where event.event_type = 'expense.manual_participant_linked'
),
classified as (
  select
    link.link_event_id,
    case
      when expense.id is null
        or link.old_manual_participant_id is null
        or link.new_account_participant_id is null
        or current_shape.participation_match_count <> 1
        or later.financial_replace_count > 0
        or (
          current_shape.latest_participation_update > link.linked_at
          and later.direct_response_count = 0
        )
        then 'UNRECONSTRUCTABLE'
      when later.direct_response_count > 0
        or later.metadata_edit_count > 0
        or later.void_count > 0
        or settlement_candidates.candidate_count > 0
        then 'REQUIRES-REVIEW'
      else 'SAFE-CANDIDATE'
    end as risk_bucket
  from raw_link_events as link
  left join public.expenses as expense on expense.id = link.expense_id
  left join lateral (
    select
      count(*)::bigint as participation_match_count,
      max(participation.updated_at) as latest_participation_update
    from public.expense_participations as participation
    where participation.expense_id = link.expense_id
      and participation.participant_id in (
        link.old_manual_participant_id,
        link.new_account_participant_id
      )
  ) as current_shape on true
  left join lateral (
    select
      count(*) filter (
        where event.event_type in ('direct.accepted', 'direct.declined')
          and event.actor_participant_id = link.new_account_participant_id
      )::bigint as direct_response_count,
      count(*) filter (
        where event.event_type = 'expense.financials_replaced'
      )::bigint as financial_replace_count,
      count(*) filter (
        where event.event_type = 'expense.metadata_updated'
      )::bigint as metadata_edit_count,
      count(*) filter (
        where event.event_type = 'expense.voided'
      )::bigint as void_count
    from public.financial_events as event
    where event.expense_id = link.expense_id
      and event.created_at > link.linked_at
  ) as later on true
  left join lateral (
    select count(distinct payment.id)::bigint as candidate_count
    from public.settlement_payments as payment
    join public.settlement_allocations as allocation
      on allocation.settlement_payment_id = payment.id
    where expense.id is not null
      and payment.currency = expense.currency
      and payment.scope = expense.scope
      and payment.space_id is not distinct from expense.space_id
      and (
        (
          payment.debtor_participant_id =
            link.new_account_participant_id
          and exists (
            select 1
            from public.expense_participations as counterpart
            where counterpart.expense_id = link.expense_id
              and counterpart.participant_id =
                allocation.creditor_participant_id
              and counterpart.participant_id <>
                link.new_account_participant_id
          )
        )
        or (
          allocation.creditor_participant_id =
            link.new_account_participant_id
          and exists (
            select 1
            from public.expense_participations as counterpart
            where counterpart.expense_id = link.expense_id
              and counterpart.participant_id =
                payment.debtor_participant_id
              and counterpart.participant_id <>
                link.new_account_participant_id
          )
        )
      )
  ) as settlement_candidates on true
)
select
  'risk_bucket_summary'::text as report_section,
  risk_bucket,
  count(*)::bigint as link_event_count
from classified
group by risk_bucket
order by
  case risk_bucket
    when 'UNRECONSTRUCTABLE' then 1
    when 'REQUIRES-REVIEW' then 2
    else 3
  end;

rollback;
