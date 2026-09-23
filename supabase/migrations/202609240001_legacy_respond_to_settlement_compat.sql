-- Temporary compatibility for the Production frontend that still calls
-- respond_to_settlement(uuid, text) and expects the parent status text.
-- The version-aware overload remains canonical. This wrapper does not
-- accept a client-supplied version and does not treat a finished
-- allocation as a successful retry.

create or replace function public.respond_to_settlement(
  target_allocation_id uuid,
  response text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  payment_id uuid;
  payment_row public.settlement_payments%rowtype;
  allocation_row public.settlement_allocations%rowtype;
  canonical jsonb;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if response not in ('accepted', 'declined') then
    raise exception using message = 'invalid_response', errcode = 'P0001';
  end if;

  select allocation.settlement_payment_id
    into payment_id
  from public.settlement_allocations as allocation
  where allocation.id = target_allocation_id;

  if payment_id is null then
    raise exception using message = 'allocation_not_found', errcode = 'P0001';
  end if;

  select *
    into payment_row
  from public.settlement_payments
  where id = payment_id
  for update;

  select *
    into allocation_row
  from public.settlement_allocations
  where id = target_allocation_id
    and settlement_payment_id = payment_row.id
  for update;

  if allocation_row.id is null then
    raise exception using
      message = 'financial_invariant_violation',
      errcode = 'P0001';
  end if;
  if allocation_row.creditor_participant_id <> actor then
    raise exception using message = 'allocation_write_denied', errcode = 'P0001';
  end if;
  if allocation_row.state <> 'pending' then
    raise exception using message = 'allocation_not_pending', errcode = 'P0001';
  end if;

  canonical := public.respond_to_settlement(
    target_allocation_id,
    response,
    payment_row.version
  );

  return canonical ->> 'payment_status';
end;
$$;

revoke all on function public.respond_to_settlement(uuid, text)
  from public, anon, authenticated;
grant execute on function public.respond_to_settlement(uuid, text)
  to authenticated;

comment on function public.respond_to_settlement(uuid, text) is
  'Deprecated temporary compatibility overload for the deployed two-argument client. It locks the pending allocation and delegates to the canonical version-aware function with that locked version. A second response fails closed.';
