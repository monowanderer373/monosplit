-- Opt-in protection for the existing rich RPC's expected_outstanding_minor.
-- No new debt records or balance writes: E - T + R uses the same ordered
-- per-expense Participant pairing as relationalBalance.ts. Legacy nine-argument
-- proposals and rich space proposals without an expectation retain their rules.
begin;

create function private.space_signed_outstanding(
  target_space_id uuid, first_participant_id uuid,
  second_participant_id uuid, currency_code text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare result_minor numeric;
begin
  with positions as (
    select participation.expense_id, participation.participant_id,
      participation.participant_order,
      coalesce(contribution.amount_minor, 0) - share.amount_minor as net_minor
    from public.expenses as expense
    join public.expense_participations as participation on participation.expense_id = expense.id
    join public.expense_shares as share on share.expense_participation_id = participation.id
    left join public.payer_contributions as contribution on contribution.expense_participation_id = participation.id
    where expense.scope = 'space' and expense.space_id = target_space_id
      and expense.status = 'active' and expense.currency = pg_catalog.upper(currency_code)
    -- Space pairing includes all participations, unlike Direct accepted/tracked.
  ), debtors as (
    select *, coalesce(pg_catalog.sum(-net_minor) over (
      partition by expense_id order by participant_order, participant_id
      rows between unbounded preceding and 1 preceding
    ), 0) as start_minor, pg_catalog.sum(-net_minor) over (
      partition by expense_id order by participant_order, participant_id
      rows between unbounded preceding and current row
    ) as end_minor from positions where net_minor < 0
  ), creditors as (
    select *, coalesce(pg_catalog.sum(net_minor) over (
      partition by expense_id order by participant_order, participant_id
      rows between unbounded preceding and 1 preceding
    ), 0) as start_minor, pg_catalog.sum(net_minor) over (
      partition by expense_id order by participant_order, participant_id
      rows between unbounded preceding and current row
    ) as end_minor from positions where net_minor > 0
  ), expense_effect as (
    select coalesce(pg_catalog.sum(
      (case when debtor.participant_id = first_participant_id then 1 else -1 end)
      * greatest(0, least(debtor.end_minor, creditor.end_minor)
        - greatest(debtor.start_minor, creditor.start_minor))
    ), 0) as amount_minor
    from debtors as debtor join creditors as creditor using (expense_id)
    where (debtor.participant_id = first_participant_id and creditor.participant_id = second_participant_id)
       or (debtor.participant_id = second_participant_id and creditor.participant_id = first_participant_id)
  ), reversals as (
    select settlement_allocation_id, pg_catalog.sum(amount_minor) as amount_minor
    from public.settlement_allocation_reversals group by settlement_allocation_id
  ), transfer_effect as (
    select coalesce(pg_catalog.sum(
      (case when payment.debtor_participant_id = first_participant_id then -1 else 1 end)
      * (case when allocation.state = 'reversed' then 0
         else allocation.amount_minor - coalesce(reversal.amount_minor, 0) end)
    ), 0) as amount_minor
    from public.settlement_payments as payment
    join public.settlement_allocations as allocation on allocation.settlement_payment_id = payment.id
    left join reversals as reversal on reversal.settlement_allocation_id = allocation.id
    where payment.scope = 'space' and payment.space_id = target_space_id
      and payment.currency = pg_catalog.upper(currency_code)
      and allocation.state in ('accepted', 'reversed')
      and ((payment.debtor_participant_id = first_participant_id and allocation.creditor_participant_id = second_participant_id)
        or (payment.debtor_participant_id = second_participant_id and allocation.creditor_participant_id = first_participant_id))
  )
  select expense_effect.amount_minor + transfer_effect.amount_minor into result_minor
  from expense_effect cross join transfer_effect;
  if pg_catalog.abs(result_minor) > 9007199254740991 then
    raise exception using message = 'amount_overflow', errcode = 'P0001';
  end if;
  return result_minor::bigint;
end;
$$;

create function private.lock_collect_pay_balance()
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Existing writers do not share a per-space advisory-lock protocol. A table
  -- lock covers those writers too, including SELECT FOR UPDATE confirmations.
  -- NOWAIT fails rather than waiting with a partially acquired lock set.
  -- Ordinary reads remain available. This is deliberately a global, short-lived
  -- write exclusion; replacing it needs ALL balance writers to share a protocol.
  lock table public.expenses, public.expense_participations,
    public.payer_contributions, public.expense_shares,
    public.settlement_allocations, public.settlement_payments,
    public.settlement_allocation_reversals in exclusive mode nowait;
exception when lock_not_available then
  raise exception using message = 'balance_changed', errcode = 'P0001';
end;
$$;

alter function public.propose_settlement(uuid,text,uuid,text,bigint,date,uuid[],bigint[],text,text,bigint,uuid[],bigint[],uuid)
  rename to phase6_propose_settlement_without_space_guard;
-- Phase 6 qualifies three arguments with its function's implicit block label.
-- Update those qualifiers after renaming; otherwise PL/pgSQL would resolve the
-- old label as a missing table instead of the original argument variables.
do $$
begin
  execute pg_catalog.replace(pg_catalog.replace(pg_catalog.pg_get_functiondef(
    'public.phase6_propose_settlement_without_space_guard(uuid,text,uuid,text,bigint,date,uuid[],bigint[],text,text,bigint,uuid[],bigint[],uuid)'::regprocedure
  ), 'propose_settlement.', 'phase6_propose_settlement_without_space_guard.'), '  item_index integer;', '');
  -- Integer FOR loops declare their own variables. Remove the redundant
  -- declaration in the existing installment helper too, preserving its body.
  execute pg_catalog.replace(pg_catalog.pg_get_functiondef(
    'private.generate_personal_installments(uuid)'::regprocedure
  ), '  item_number integer;', '');
end;
$$;
revoke all on function public.phase6_propose_settlement_without_space_guard(uuid,text,uuid,text,bigint,date,uuid[],bigint[],text,text,bigint,uuid[],bigint[],uuid)
  from public, anon, authenticated;

create function public.propose_settlement(
  request_id uuid, settlement_scope text, target_space_id uuid,
  currency_code text, total_amount_minor bigint, payment_date date,
  creditor_ids uuid[], allocation_amounts bigint[], settlement_note text,
  overpay_disposition text, expected_outstanding_minor bigint,
  selected_expense_ids uuid[], attribution_amounts bigint[], source_payment_request_id uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := private.require_personal_actor();
  current_minor bigint;
  total_outstanding numeric := 0;
  exceeds_outstanding boolean := false;
begin
  if settlement_scope = 'space' and expected_outstanding_minor is not null then
    if private.space_role(target_space_id, actor) is null then
      raise exception using message = 'space_membership_required', errcode = 'P0001';
    end if;
    if creditor_ids is null or allocation_amounts is null
       or pg_catalog.cardinality(creditor_ids) = 0
       or pg_catalog.cardinality(creditor_ids) <> pg_catalog.cardinality(allocation_amounts) then
      raise exception using message = 'invalid_allocation_arrays', errcode = 'P0001';
    end if;
    perform private.lock_collect_pay_balance();
    -- Retry must reconcile the immutable original payload, even after confirmed
    -- payments change the current balance. The delegated RPC validates it.
    if not exists (select 1 from public.settlement_payments
      where debtor_participant_id = actor and client_request_id = request_id) then
      for item_index in 1..pg_catalog.cardinality(creditor_ids) loop
        if private.space_role(target_space_id, creditor_ids[item_index]) is null then
          raise exception using message = 'space_membership_required', errcode = 'P0001';
        end if;
        current_minor := private.space_signed_outstanding(
          target_space_id, actor, creditor_ids[item_index], currency_code);
        if current_minor <= 0 then
          raise exception using message = 'no_outstanding_debt', errcode = 'P0001';
        end if;
        total_outstanding := total_outstanding + current_minor;
        exceeds_outstanding := exceeds_outstanding or allocation_amounts[item_index] > current_minor;
      end loop;
      if total_outstanding <> expected_outstanding_minor then
        raise exception using message = 'balance_changed', errcode = 'P0001';
      end if;
      if exceeds_outstanding then
        raise exception using message = 'amount_exceeds_outstanding_balance', errcode = 'P0001';
      end if;
    end if;
  end if;
  return public.phase6_propose_settlement_without_space_guard(
    request_id, settlement_scope, target_space_id, currency_code, total_amount_minor,
    payment_date, creditor_ids, allocation_amounts, settlement_note, overpay_disposition,
    expected_outstanding_minor, selected_expense_ids, attribution_amounts, source_payment_request_id);
end;
$$;

alter function public.respond_to_settlement(uuid,text,integer)
  rename to phase6_respond_to_settlement_without_space_guard;
revoke all on function public.phase6_respond_to_settlement_without_space_guard(uuid,text,integer)
  from public, anon, authenticated;

create function public.respond_to_settlement(
  target_allocation_id uuid, response text, expected_payment_version integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := public.current_participant_id();
  allocation_row public.settlement_allocations%rowtype;
  payment_row public.settlement_payments%rowtype;
begin
  -- Plain reads before taking the table locks avoid inverted row-lock order.
  select * into allocation_row from public.settlement_allocations where id = target_allocation_id;
  select * into payment_row from public.settlement_payments where id = allocation_row.settlement_payment_id;
  if response = 'accepted' and payment_row.scope = 'space'
     and payment_row.cash_tracking_required and payment_row.expected_outstanding_minor is not null
     and allocation_row.state = 'pending' then
    if actor is null or actor <> allocation_row.creditor_participant_id then
      raise exception using message = 'allocation_write_denied', errcode = 'P0001';
    end if;
    perform private.lock_collect_pay_balance();
    -- Re-read after locking: another transaction could have confirmed this or
    -- another payment between the first read and lock acquisition.
    select * into allocation_row from public.settlement_allocations where id = target_allocation_id;
    select * into payment_row from public.settlement_payments where id = allocation_row.settlement_payment_id;
    if allocation_row.state = 'pending' and private.space_signed_outstanding(
      payment_row.space_id, payment_row.debtor_participant_id,
      allocation_row.creditor_participant_id, payment_row.currency
    ) < allocation_row.amount_minor then
      raise exception using message = 'balance_changed', errcode = 'P0001';
    end if;
  end if;
  return public.phase6_respond_to_settlement_without_space_guard(
    target_allocation_id, response, expected_payment_version);
end;
$$;

revoke all on function private.space_signed_outstanding(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function private.lock_collect_pay_balance() from public, anon, authenticated;
revoke all on function public.propose_settlement(uuid,text,uuid,text,bigint,date,uuid[],bigint[],text,text,bigint,uuid[],bigint[],uuid) from public, anon, authenticated;
revoke all on function public.respond_to_settlement(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.propose_settlement(uuid,text,uuid,text,bigint,date,uuid[],bigint[],text,text,bigint,uuid[],bigint[],uuid) to authenticated;
grant execute on function public.respond_to_settlement(uuid,text,integer) to authenticated;

commit;
