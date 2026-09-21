-- Phase 6E: shared settlement intent with owner-private cash movements.
--
-- Shared allocations remain the only T in F = E - T + R.  Each participant
-- chooses only their own account, and those bindings are never copied to a
-- shared row or financial_events.safe_diff.

create extension if not exists "uuid-ossp" with schema extensions;

create table public.settlement_payment_requests (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  creditor_participant_id uuid not null references public.participants(id),
  debtor_participant_id uuid not null references public.participants(id),
  scope text not null check (scope in ('direct', 'space')),
  space_id uuid references public.spaces(id) on delete restrict,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor between 1 and 9007199254740991),
  note text,
  status text not null default 'open'
    check (status in ('open', 'converted', 'cancelled', 'expired')),
  converted_payment_id uuid,
  expires_at timestamptz,
  converted_at timestamptz,
  cancelled_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (creditor_participant_id, client_request_id),
  check (creditor_participant_id <> debtor_participant_id),
  check (
    (scope = 'direct' and space_id is null)
    or (scope = 'space' and space_id is not null)
  ),
  check (
    (status = 'open' and converted_payment_id is null
      and converted_at is null and cancelled_at is null)
    or (status = 'converted' and converted_payment_id is not null
      and converted_at is not null and cancelled_at is null)
    or (status = 'cancelled' and converted_payment_id is null
      and converted_at is null and cancelled_at is not null)
    or (status = 'expired' and converted_payment_id is null
      and converted_at is null and cancelled_at is null)
  )
);

create index settlement_payment_requests_participants_idx
  on public.settlement_payment_requests(
    creditor_participant_id, debtor_participant_id, status, created_at desc
  );

alter table public.settlement_payments
  add column cash_tracking_required boolean not null default false,
  add column overpay_disposition text
    check (overpay_disposition is null or overpay_disposition in ('gift', 'carry')),
  add column expected_outstanding_minor bigint
    check (expected_outstanding_minor is null
      or expected_outstanding_minor between 1 and 9007199254740991),
  add column source_payment_request_id uuid
    references public.settlement_payment_requests(id) on delete restrict;

alter table public.settlement_payment_requests
  add constraint settlement_payment_requests_converted_payment_fk
  foreign key (converted_payment_id)
  references public.settlement_payments(id) on delete restrict;

create table public.settlement_attribution_intents (
  id uuid primary key default gen_random_uuid(),
  settlement_payment_id uuid not null
    references public.settlement_payments(id) on delete restrict,
  settlement_allocation_id uuid not null
    references public.settlement_allocations(id) on delete restrict,
  expense_id uuid not null references public.expenses(id) on delete restrict,
  amount_minor bigint not null check (amount_minor between 1 and 9007199254740991),
  item_order integer not null check (item_order > 0),
  created_at timestamptz not null default pg_catalog.now(),
  unique (settlement_allocation_id, expense_id),
  unique (settlement_allocation_id, item_order)
);

create index settlement_attribution_intents_payment_idx
  on public.settlement_attribution_intents(settlement_payment_id, settlement_allocation_id);

create table public.personal_settlement_cash_legs (
  id uuid primary key default gen_random_uuid(),
  owner_participant_id uuid not null references public.participants(id),
  client_request_id uuid not null,
  payload_fingerprint text not null check (payload_fingerprint ~ '^[0-9a-f]{64}$'),
  settlement_payment_id uuid not null
    references public.settlement_payments(id) on delete restrict,
  settlement_allocation_id uuid not null
    references public.settlement_allocations(id) on delete restrict,
  role text not null check (role in ('payer', 'receiver')),
  account_id uuid not null references public.personal_accounts(id) on delete restrict,
  cash_amount_minor bigint not null check (cash_amount_minor between 1 and 9007199254740991),
  account_currency text not null check (account_currency ~ '^[A-Z]{3}$'),
  shared_amount_minor bigint not null check (shared_amount_minor between 1 and 9007199254740991),
  gift_extra_minor bigint not null default 0
    check (gift_extra_minor between 0 and 9007199254740991),
  status text not null default 'pending'
    check (status in ('pending', 'posted', 'reversed', 'cancelled')),
  posted_transaction_id uuid
    references public.personal_account_transactions(id) on delete restrict,
  gift_transaction_id uuid
    references public.personal_account_transactions(id) on delete restrict,
  posted_reversal_transaction_id uuid
    references public.personal_account_transactions(id) on delete restrict,
  gift_reversal_transaction_id uuid
    references public.personal_account_transactions(id) on delete restrict,
  posted_at timestamptz,
  reversed_at timestamptz,
  cancelled_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  unique (owner_participant_id, client_request_id),
  unique (settlement_allocation_id, owner_participant_id, role),
  unique (posted_transaction_id),
  unique (gift_transaction_id),
  unique (posted_reversal_transaction_id),
  unique (gift_reversal_transaction_id),
  check (gift_extra_minor = 0 or cash_amount_minor = shared_amount_minor + gift_extra_minor),
  check (
    (status = 'pending' and posted_transaction_id is null
      and gift_transaction_id is null and posted_reversal_transaction_id is null
      and gift_reversal_transaction_id is null and posted_at is null
      and reversed_at is null and cancelled_at is null)
    or (status = 'posted' and posted_transaction_id is not null
      and posted_reversal_transaction_id is null and gift_reversal_transaction_id is null
      and posted_at is not null and reversed_at is null and cancelled_at is null
      and ((gift_extra_minor = 0 and gift_transaction_id is null)
        or (gift_extra_minor > 0 and gift_transaction_id is not null)))
    or (status = 'reversed' and posted_transaction_id is not null
      and posted_reversal_transaction_id is not null and posted_at is not null
      and reversed_at is not null and cancelled_at is null
      and ((gift_extra_minor = 0 and gift_transaction_id is null
          and gift_reversal_transaction_id is null)
        or (gift_extra_minor > 0 and gift_transaction_id is not null
          and gift_reversal_transaction_id is not null)))
    or (status = 'cancelled' and posted_transaction_id is null
      and gift_transaction_id is null and posted_reversal_transaction_id is null
      and gift_reversal_transaction_id is null and posted_at is null
      and reversed_at is null and cancelled_at is not null)
  )
);

create index personal_settlement_cash_legs_owner_status_idx
  on public.personal_settlement_cash_legs(owner_participant_id, status, created_at desc);

create trigger settlement_payment_requests_set_updated_at
  before update on public.settlement_payment_requests
  for each row execute function public.set_updated_at();

create trigger personal_settlement_cash_legs_set_updated_at
  before update on public.personal_settlement_cash_legs
  for each row execute function public.set_updated_at();

alter table public.settlement_payment_requests enable row level security;
alter table public.settlement_attribution_intents enable row level security;
alter table public.personal_settlement_cash_legs enable row level security;

create policy settlement_payment_requests_select_participant
  on public.settlement_payment_requests for select to authenticated
  using (
    (select auth.uid()) is not null
    and public.current_participant_id() in (
      creditor_participant_id, debtor_participant_id
    )
  );

create policy settlement_attribution_intents_select_visible
  on public.settlement_attribution_intents for select to authenticated
  using (
    (select auth.uid()) is not null
    and private.can_read_settlement(
      settlement_payment_id, public.current_participant_id()
    )
  );

create policy personal_settlement_cash_legs_select_owner
  on public.personal_settlement_cash_legs for select to authenticated
  using (
    (select auth.uid()) is not null
    and owner_participant_id = public.current_participant_id()
  );

revoke all on table public.settlement_payment_requests from public, anon, authenticated;
revoke all on table public.settlement_attribution_intents from public, anon, authenticated;
revoke all on table public.personal_settlement_cash_legs from public, anon, authenticated;
grant select on table public.settlement_payment_requests to authenticated;
grant select on table public.settlement_attribution_intents to authenticated;
grant select on table public.personal_settlement_cash_legs to authenticated;

create or replace function private.direct_expense_obligation(
  target_expense_id uuid,
  target_debtor_id uuid,
  target_creditor_id uuid
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with positions as (
    select participation.expense_id,
      participation.participant_id,
      participation.participant_order,
      coalesce(contribution.amount_minor, 0) - share.amount_minor as net_minor
    from public.expense_participations as participation
    left join public.payer_contributions as contribution
      on contribution.expense_participation_id = participation.id
    join public.expense_shares as share
      on share.expense_participation_id = participation.id
    join public.expenses as expense on expense.id = participation.expense_id
    where participation.expense_id = target_expense_id
      and participation.state = 'accepted'
      and participation.tracking_mode = 'tracked'
      and expense.status = 'active'
      and expense.scope = 'direct'
  ), debtors as (
    select *, -net_minor as amount_minor,
      coalesce(pg_catalog.sum(-net_minor) over (
        partition by expense_id order by participant_order, participant_id
        rows between unbounded preceding and 1 preceding
      ), 0) as start_minor,
      pg_catalog.sum(-net_minor) over (
        partition by expense_id order by participant_order, participant_id
        rows between unbounded preceding and current row
      ) as end_minor
    from positions where net_minor < 0
  ), creditors as (
    select *, net_minor as amount_minor,
      coalesce(pg_catalog.sum(net_minor) over (
        partition by expense_id order by participant_order, participant_id
        rows between unbounded preceding and 1 preceding
      ), 0) as start_minor,
      pg_catalog.sum(net_minor) over (
        partition by expense_id order by participant_order, participant_id
        rows between unbounded preceding and current row
      ) as end_minor
    from positions where net_minor > 0
  )
  select coalesce(pg_catalog.sum(
    greatest(0, least(debtor.end_minor, creditor.end_minor)
      - greatest(debtor.start_minor, creditor.start_minor))
  ), 0)::bigint
  from debtors as debtor
  join creditors as creditor on creditor.expense_id = debtor.expense_id
  where debtor.participant_id = target_debtor_id
    and creditor.participant_id = target_creditor_id;
$$;

create or replace function private.direct_signed_outstanding(
  first_participant_id uuid,
  second_participant_id uuid,
  currency_code text
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with relevant_expenses as (
    select expense.id
    from public.expenses as expense
    where expense.scope = 'direct'
      and expense.status = 'active'
      and expense.currency = pg_catalog.upper(currency_code)
      and exists (
        select 1 from public.expense_participations
        where expense_id = expense.id
          and participant_id = first_participant_id
          and state = 'accepted' and tracking_mode = 'tracked'
      )
      and exists (
        select 1 from public.expense_participations
        where expense_id = expense.id
          and participant_id = second_participant_id
          and state = 'accepted' and tracking_mode = 'tracked'
      )
  ), expense_effect as (
    select coalesce(pg_catalog.sum(
      private.direct_expense_obligation(
        expense.id, first_participant_id, second_participant_id
      ) - private.direct_expense_obligation(
        expense.id, second_participant_id, first_participant_id
      )
    ), 0)::bigint as amount_minor
    from relevant_expenses as expense
  ), transfer_effect as (
    select coalesce(pg_catalog.sum(
      case
        when payment.debtor_participant_id = first_participant_id
          and allocation.creditor_participant_id = second_participant_id
          then -(case when allocation.state = 'reversed' then 0
            else allocation.amount_minor - coalesce(reversal.amount_minor, 0) end)
        when payment.debtor_participant_id = second_participant_id
          and allocation.creditor_participant_id = first_participant_id
          then (case when allocation.state = 'reversed' then 0
            else allocation.amount_minor - coalesce(reversal.amount_minor, 0) end)
        else 0
      end
    ), 0)::bigint as amount_minor
    from public.settlement_payments as payment
    join public.settlement_allocations as allocation
      on allocation.settlement_payment_id = payment.id
    left join public.settlement_allocation_reversals as reversal
      on reversal.settlement_allocation_id = allocation.id
    where payment.scope = 'direct'
      and payment.currency = pg_catalog.upper(currency_code)
      and allocation.state in ('accepted', 'reversed')
      and (
        payment.debtor_participant_id = first_participant_id
          and allocation.creditor_participant_id = second_participant_id
        or payment.debtor_participant_id = second_participant_id
          and allocation.creditor_participant_id = first_participant_id
      )
  )
  select expense_effect.amount_minor + transfer_effect.amount_minor
  from expense_effect cross join transfer_effect;
$$;

create or replace function public.get_direct_outstanding(
  target_counterparty_id uuid,
  currency_code text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  signed_amount bigint;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  if target_counterparty_id is null or target_counterparty_id = actor
     or currency_code is null or pg_catalog.upper(currency_code) !~ '^[A-Z]{3}$' then
    raise exception using message = 'invalid_direct_outstanding_query', errcode = 'P0001';
  end if;
  if not private.has_friend_history(actor, target_counterparty_id) then
    raise exception using message = 'direct_counterparty_not_friend', errcode = 'P0001';
  end if;
  signed_amount := private.direct_signed_outstanding(
    actor, target_counterparty_id, pg_catalog.upper(currency_code)
  );
  return pg_catalog.jsonb_build_object(
    'currency', pg_catalog.upper(currency_code),
    'signed_outstanding_minor', signed_amount,
    'debtor_participant_id', case when signed_amount > 0 then actor
      when signed_amount < 0 then target_counterparty_id else null end,
    'creditor_participant_id', case when signed_amount > 0 then target_counterparty_id
      when signed_amount < 0 then actor else null end,
    'amount_minor', pg_catalog.abs(signed_amount)
  );
end;
$$;

create or replace function public.create_settlement_payment_request(
  request_id uuid,
  target_debtor_id uuid,
  request_scope text,
  target_space_id uuid,
  currency_code text,
  requested_amount_minor bigint,
  request_note text default null,
  request_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  fingerprint text;
  request_row public.settlement_payment_requests%rowtype;
begin
  if request_id is null or target_debtor_id is null or target_debtor_id = actor
     or request_scope not in ('direct', 'space')
     or currency_code is null or pg_catalog.upper(currency_code) !~ '^[A-Z]{3}$'
     or requested_amount_minor is null
     or requested_amount_minor not between 1 and 9007199254740991
     or (request_scope = 'direct' and target_space_id is not null)
     or (request_scope = 'space' and target_space_id is null) then
    raise exception using message = 'invalid_settlement_payment_request', errcode = 'P0001';
  end if;
  if request_scope = 'direct' then
    if not private.has_friend_history(actor, target_debtor_id) then
      raise exception using message = 'direct_counterparty_not_friend', errcode = 'P0001';
    end if;
    if private.direct_signed_outstanding(
      target_debtor_id, actor, pg_catalog.upper(currency_code)
    ) < requested_amount_minor then
      raise exception using message = 'request_exceeds_outstanding_balance', errcode = 'P0001';
    end if;
  elsif private.space_role(target_space_id, actor) is null
     or private.space_role(target_space_id, target_debtor_id) is null then
    raise exception using message = 'space_membership_required', errcode = 'P0001';
  end if;

  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'debtor_id', target_debtor_id, 'scope', request_scope,
    'space_id', target_space_id, 'currency', pg_catalog.upper(currency_code),
    'amount_minor', requested_amount_minor,
    'note', nullif(pg_catalog.btrim(request_note), ''),
    'expires_at', request_expires_at
  ));
  select * into request_row from public.settlement_payment_requests
  where creditor_participant_id = actor and client_request_id = request_id;
  if request_row.id is not null then
    if request_row.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
  else
    insert into public.settlement_payment_requests(
      client_request_id, payload_fingerprint, creditor_participant_id,
      debtor_participant_id, scope, space_id, currency, amount_minor,
      note, expires_at
    ) values (
      request_id, fingerprint, actor, target_debtor_id, request_scope,
      target_space_id, pg_catalog.upper(currency_code), requested_amount_minor,
      nullif(pg_catalog.btrim(request_note), ''), request_expires_at
    ) returning * into request_row;
  end if;
  return pg_catalog.jsonb_build_object(
    'payment_request_id', request_row.id, 'status', request_row.status,
    'currency', request_row.currency, 'amount_minor', request_row.amount_minor,
    'version', request_row.version
  );
end;
$$;

create or replace function public.cancel_settlement_payment_request(
  target_request_id uuid,
  expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  request_row public.settlement_payment_requests%rowtype;
begin
  select * into request_row from public.settlement_payment_requests
  where id = target_request_id for update;
  if request_row.id is null then
    raise exception using message = 'settlement_payment_request_not_found', errcode = 'P0001';
  end if;
  if request_row.creditor_participant_id <> actor then
    raise exception using message = 'settlement_payment_request_write_denied', errcode = 'P0001';
  end if;
  if request_row.status = 'cancelled' then
    return pg_catalog.jsonb_build_object(
      'payment_request_id', request_row.id, 'status', request_row.status,
      'version', request_row.version
    );
  end if;
  if request_row.status <> 'open' then
    raise exception using message = 'settlement_payment_request_state_conflict', errcode = 'P0001';
  end if;
  if expected_version is null or expected_version <> request_row.version then
    raise exception using message = 'version_conflict', errcode = 'P0001';
  end if;
  update public.settlement_payment_requests
  set status = 'cancelled', cancelled_at = pg_catalog.now(), version = version + 1
  where id = request_row.id returning * into request_row;
  return pg_catalog.jsonb_build_object(
    'payment_request_id', request_row.id, 'status', request_row.status,
    'version', request_row.version
  );
end;
$$;

create or replace function public.propose_settlement(
  request_id uuid,
  settlement_scope text,
  target_space_id uuid,
  currency_code text,
  total_amount_minor bigint,
  payment_date date,
  creditor_ids uuid[],
  allocation_amounts bigint[],
  settlement_note text,
  overpay_disposition text,
  expected_outstanding_minor bigint,
  selected_expense_ids uuid[],
  attribution_amounts bigint[],
  source_payment_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  current_outstanding bigint;
  payment_id uuid;
  allocation_id uuid;
  item_index integer;
  attribution_total numeric;
  request_row public.settlement_payment_requests%rowtype;
begin
  if overpay_disposition is not null
     and overpay_disposition not in ('gift', 'carry') then
    raise exception using message = 'invalid_overpay_disposition', errcode = 'P0001';
  end if;
  if selected_expense_ids is distinct from null
     or attribution_amounts is distinct from null then
    if selected_expense_ids is null or attribution_amounts is null
       or pg_catalog.cardinality(selected_expense_ids) = 0
       or pg_catalog.cardinality(selected_expense_ids)
         <> pg_catalog.cardinality(attribution_amounts) then
      raise exception using message = 'invalid_attribution_arrays', errcode = 'P0001';
    end if;
  end if;
  if exists (
    select 1
    from pg_catalog.unnest(creditor_ids) as creditor(value)
    left join public.participants as participant on participant.id = creditor.value
    where participant.kind is distinct from 'account'
  ) then
    raise exception using message = 'settlement_cash_requires_account_creditors', errcode = 'P0001';
  end if;

  if settlement_scope = 'direct' then
    if pg_catalog.cardinality(creditor_ids) <> 1 then
      raise exception using message = 'invalid_direct_settlement', errcode = 'P0001';
    end if;
    current_outstanding := private.direct_signed_outstanding(
      actor, creditor_ids[1], pg_catalog.upper(currency_code)
    );
    if current_outstanding <= 0 then
      raise exception using message = 'no_outstanding_debt', errcode = 'P0001';
    end if;
    if expected_outstanding_minor is null
       or expected_outstanding_minor <> current_outstanding then
      raise exception using message = 'balance_changed', errcode = 'P0001';
    end if;
    if overpay_disposition is null and total_amount_minor > current_outstanding then
      raise exception using message = 'amount_exceeds_outstanding_balance', errcode = 'P0001';
    elsif overpay_disposition = 'gift' and total_amount_minor <> current_outstanding then
      raise exception using message = 'gift_shared_amount_must_equal_outstanding', errcode = 'P0001';
    elsif overpay_disposition = 'carry' and total_amount_minor < current_outstanding then
      raise exception using message = 'carry_amount_must_cover_outstanding', errcode = 'P0001';
    end if;
  elsif overpay_disposition is not null then
    raise exception using message = 'overpay_direct_only', errcode = 'P0001';
  end if;

  if source_payment_request_id is not null then
    select * into request_row from public.settlement_payment_requests
    where id = source_payment_request_id for update;
    if request_row.id is null or request_row.status not in ('open', 'converted')
       or request_row.debtor_participant_id <> actor
       or request_row.scope <> settlement_scope
       or request_row.space_id is distinct from target_space_id
       or request_row.currency <> pg_catalog.upper(currency_code)
       or not (request_row.creditor_participant_id = any(creditor_ids))
       or (request_row.status = 'converted' and not exists (
         select 1 from public.settlement_payments as converted
         where converted.id = request_row.converted_payment_id
           and converted.debtor_participant_id = actor
           and converted.client_request_id = request_id
       )) then
      raise exception using message = 'settlement_payment_request_mismatch', errcode = 'P0001';
    end if;
  end if;

  payment_id := public.propose_settlement(
    request_id, settlement_scope, target_space_id, currency_code,
    total_amount_minor, payment_date, creditor_ids,
    allocation_amounts, settlement_note
  );
  update public.settlement_payments as payment
  set cash_tracking_required = true,
      overpay_disposition = propose_settlement.overpay_disposition,
      expected_outstanding_minor = propose_settlement.expected_outstanding_minor,
      source_payment_request_id = propose_settlement.source_payment_request_id
  where payment.id = payment_id
    and (
      payment.cash_tracking_required = false
      or payment.overpay_disposition is not distinct from propose_settlement.overpay_disposition
        and payment.expected_outstanding_minor is not distinct from propose_settlement.expected_outstanding_minor
        and payment.source_payment_request_id is not distinct from propose_settlement.source_payment_request_id
    );
  if not found then
    raise exception using message = 'idempotency_conflict', errcode = 'P0001';
  end if;

  if selected_expense_ids is not null then
    if settlement_scope <> 'direct' then
      raise exception using message = 'selected_bills_direct_only', errcode = 'P0001';
    end if;
    select id into allocation_id from public.settlement_allocations
    where settlement_payment_id = payment_id
      and creditor_participant_id = creditor_ids[1];
    select coalesce(pg_catalog.sum(value), 0) into attribution_total
    from pg_catalog.unnest(attribution_amounts) as amount(value);
    if attribution_total > allocation_amounts[1]
       or exists (
         select 1 from pg_catalog.unnest(attribution_amounts) as amount(value)
         where value is null or value <= 0
       ) then
      raise exception using message = 'invalid_attribution_amount', errcode = 'P0001';
    end if;
    if exists (
      select 1 from public.settlement_attribution_intents
      where settlement_allocation_id = allocation_id
    ) then
      if (select pg_catalog.count(*) from public.settlement_attribution_intents
          where settlement_allocation_id = allocation_id)
          <> pg_catalog.cardinality(selected_expense_ids)
         or exists (
           select 1
           from pg_catalog.unnest(selected_expense_ids)
             with ordinality as selected(expense_id, item_order)
           join pg_catalog.unnest(attribution_amounts)
             with ordinality as supplied(amount_minor, item_order)
             using (item_order)
           where not exists (
             select 1 from public.settlement_attribution_intents as saved
             where saved.settlement_allocation_id = allocation_id
               and saved.expense_id = selected.expense_id
               and saved.amount_minor = supplied.amount_minor
               and saved.item_order = selected.item_order
           )
         ) then
        raise exception using message = 'idempotency_conflict', errcode = 'P0001';
      end if;
    else
      for item_index in 1..pg_catalog.cardinality(selected_expense_ids) loop
        if private.direct_expense_obligation(
          selected_expense_ids[item_index], actor, creditor_ids[1]
        ) < attribution_amounts[item_index] then
          raise exception using message = 'invalid_settlement_attribution', errcode = 'P0001';
        end if;
        insert into public.settlement_attribution_intents(
          settlement_payment_id, settlement_allocation_id, expense_id,
          amount_minor, item_order
        ) values (
          payment_id, allocation_id, selected_expense_ids[item_index],
          attribution_amounts[item_index], item_index
        );
      end loop;
    end if;
  end if;

  if request_row.id is not null and request_row.status = 'open' then
    update public.settlement_payment_requests
    set status = 'converted', converted_payment_id = payment_id,
        converted_at = pg_catalog.now(), version = version + 1
    where id = request_row.id;
  end if;
  return payment_id;
end;
$$;

create or replace function private.settlement_cash_request_id(
  target_allocation_id uuid,
  target_owner_id uuid,
  target_role text,
  request_kind text
)
returns uuid
language sql
immutable
strict
set search_path = ''
as $$
  select extensions.uuid_generate_v5(
    '76c9cd65-ed72-51b4-8244-2b06bdb3661e'::uuid,
    target_allocation_id::text || ':' || target_owner_id::text
      || ':' || target_role || ':' || request_kind
  );
$$;

create or replace function public.authorize_personal_settlement_cash_leg(
  request_id uuid,
  target_allocation_id uuid,
  cash_role text,
  target_account_id uuid,
  supplied_cash_amount_minor bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_personal_actor();
  allocation_row public.settlement_allocations%rowtype;
  payment_row public.settlement_payments%rowtype;
  account_row public.personal_accounts%rowtype;
  payer_leg public.personal_settlement_cash_legs%rowtype;
  existing_leg public.personal_settlement_cash_legs%rowtype;
  effective_cash bigint;
  gift_extra bigint := 0;
  fingerprint text;
begin
  if request_id is null or target_allocation_id is null
     or cash_role not in ('payer', 'receiver') or target_account_id is null then
    raise exception using message = 'invalid_settlement_cash_authorization', errcode = 'P0001';
  end if;
  select * into allocation_row from public.settlement_allocations
  where id = target_allocation_id for update;
  select * into payment_row from public.settlement_payments
  where id = allocation_row.settlement_payment_id for update;
  if allocation_row.id is null or payment_row.id is null then
    raise exception using message = 'allocation_not_found', errcode = 'P0001';
  end if;
  if not payment_row.cash_tracking_required then
    raise exception using message = 'settlement_cash_tracking_not_enabled', errcode = 'P0001';
  end if;
  if allocation_row.state <> 'pending' then
    raise exception using message = 'allocation_not_pending', errcode = 'P0001';
  end if;
  if (cash_role = 'payer' and payment_row.debtor_participant_id <> actor)
     or (cash_role = 'receiver' and allocation_row.creditor_participant_id <> actor) then
    raise exception using message = 'settlement_cash_authorization_denied', errcode = 'P0001';
  end if;
  select * into account_row from public.personal_accounts
  where id = target_account_id and owner_participant_id = actor for update;
  if account_row.id is null or account_row.account_class <> 'asset'
     or account_row.archived_at is not null then
    raise exception using message = 'settlement_cash_account_invalid', errcode = 'P0001';
  end if;

  if cash_role = 'payer' then
    effective_cash := supplied_cash_amount_minor;
    if effective_cash is null or effective_cash not between 1 and 9007199254740991 then
      raise exception using message = 'invalid_settlement_cash_amount', errcode = 'P0001';
    end if;
  else
    select * into payer_leg from public.personal_settlement_cash_legs
    where settlement_allocation_id = allocation_row.id and role = 'payer'
      and status = 'pending';
    if payer_leg.id is null then
      raise exception using message = 'payer_cash_authorization_required', errcode = 'P0001';
    end if;
    effective_cash := coalesce(supplied_cash_amount_minor, payer_leg.cash_amount_minor);
    if effective_cash <> payer_leg.cash_amount_minor then
      raise exception using message = 'settlement_cash_amount_mismatch', errcode = 'P0001';
    end if;
  end if;

  if payment_row.overpay_disposition = 'gift' then
    if account_row.currency <> payment_row.currency
       or effective_cash < allocation_row.amount_minor then
      raise exception using message = 'gift_cash_must_match_settlement_currency', errcode = 'P0001';
    end if;
    gift_extra := effective_cash - allocation_row.amount_minor;
  elsif account_row.currency = payment_row.currency
     and effective_cash <> allocation_row.amount_minor then
    raise exception using message = 'settlement_cash_amount_mismatch', errcode = 'P0001';
  end if;

  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'allocation_id', allocation_row.id, 'role', cash_role,
    'account_id', account_row.id, 'cash_amount_minor', effective_cash,
    'account_currency', account_row.currency,
    'shared_amount_minor', allocation_row.amount_minor,
    'gift_extra_minor', gift_extra
  ));
  select * into existing_leg from public.personal_settlement_cash_legs
  where owner_participant_id = actor and client_request_id = request_id;
  if existing_leg.id is not null then
    if existing_leg.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
  else
    select * into existing_leg from public.personal_settlement_cash_legs
    where settlement_allocation_id = allocation_row.id
      and owner_participant_id = actor and role = cash_role;
    if existing_leg.id is not null then
      if existing_leg.payload_fingerprint <> fingerprint then
        raise exception using message = 'settlement_cash_authorization_conflict', errcode = 'P0001';
      end if;
    else
      insert into public.personal_settlement_cash_legs(
        owner_participant_id, client_request_id, payload_fingerprint,
        settlement_payment_id, settlement_allocation_id, role, account_id,
        cash_amount_minor, account_currency, shared_amount_minor,
        gift_extra_minor, status
      ) values (
        actor, request_id, fingerprint, payment_row.id, allocation_row.id,
        cash_role, account_row.id, effective_cash, account_row.currency,
        allocation_row.amount_minor, gift_extra, 'pending'
      ) returning * into existing_leg;
    end if;
  end if;
  return pg_catalog.jsonb_build_object(
    'cash_leg_id', existing_leg.id, 'role', existing_leg.role,
    'account_id', existing_leg.account_id,
    'cash_amount_minor', existing_leg.cash_amount_minor,
    'account_currency', existing_leg.account_currency,
    'gift_extra_minor', existing_leg.gift_extra_minor,
    'status', existing_leg.status, 'version', existing_leg.version
  );
end;
$$;

create or replace function private.post_settlement_account_transaction(
  target_owner_id uuid,
  request_id uuid,
  target_allocation_id uuid,
  target_account_id uuid,
  transaction_kind text,
  amount_minor bigint,
  transaction_date date,
  transaction_memo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_row public.personal_accounts%rowtype;
  existing_row public.personal_account_transactions%rowtype;
  fingerprint text;
  transaction_id uuid;
  signed_amount bigint;
begin
  select * into account_row from public.personal_accounts
  where id = target_account_id and owner_participant_id = target_owner_id for update;
  if account_row.id is null or account_row.account_class <> 'asset'
     or account_row.archived_at is not null then
    raise exception using message = 'settlement_cash_account_invalid', errcode = 'P0001';
  end if;
  if transaction_kind not in ('settlement_out', 'settlement_in', 'gift_out', 'gift_in')
     or amount_minor is null or amount_minor <= 0 then
    raise exception using message = 'invalid_settlement_cash_transaction', errcode = 'P0001';
  end if;
  signed_amount := case when transaction_kind in ('settlement_out', 'gift_out')
    then -amount_minor else amount_minor end;
  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'kind', transaction_kind, 'allocation_id', target_allocation_id,
    'account_id', target_account_id, 'amount_minor', amount_minor,
    'occurred_on', transaction_date
  ));
  select * into existing_row from public.personal_account_transactions
  where owner_participant_id = target_owner_id and client_request_id = request_id;
  if existing_row.id is not null then
    if existing_row.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return existing_row.id;
  end if;
  insert into public.personal_account_transactions(
    owner_participant_id, client_request_id, payload_fingerprint,
    kind, occurred_on, memo, settlement_allocation_id
  ) values (
    target_owner_id, request_id, fingerprint, transaction_kind,
    transaction_date, nullif(pg_catalog.btrim(transaction_memo), ''),
    target_allocation_id
  ) returning id into transaction_id;
  insert into public.personal_account_entries(
    transaction_id, account_id, amount_minor, currency
  ) values (
    transaction_id, account_row.id, signed_amount, account_row.currency
  );
  update public.personal_accounts set version = version + 1 where id = account_row.id;
  perform private.assert_personal_transaction_invariants(transaction_id);
  insert into public.personal_account_events(
    owner_participant_id, client_request_id, payload_fingerprint,
    account_id, transaction_id, event_type, safe_diff
  ) values (
    target_owner_id, request_id, fingerprint, account_row.id, transaction_id,
    'settlement_cash.posted', pg_catalog.jsonb_build_object(
      'transaction_id', transaction_id, 'kind', transaction_kind,
      'amount_minor', amount_minor, 'currency', account_row.currency
    )
  );
  return transaction_id;
end;
$$;

create or replace function private.post_personal_settlement_cash_leg(target_leg_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  leg_row public.personal_settlement_cash_legs%rowtype;
  payment_row public.settlement_payments%rowtype;
  shared_kind text;
  gift_kind text;
  shared_cash_amount bigint;
  shared_transaction uuid;
  gift_transaction uuid;
begin
  select * into leg_row from public.personal_settlement_cash_legs
  where id = target_leg_id for update;
  if leg_row.id is null then
    raise exception using message = 'settlement_cash_leg_not_found', errcode = 'P0001';
  end if;
  if leg_row.status = 'posted' then return; end if;
  if leg_row.status <> 'pending' then
    raise exception using message = 'settlement_cash_leg_state_conflict', errcode = 'P0001';
  end if;
  select * into payment_row from public.settlement_payments
  where id = leg_row.settlement_payment_id;
  shared_kind := case when leg_row.role = 'payer' then 'settlement_out' else 'settlement_in' end;
  gift_kind := case when leg_row.role = 'payer' then 'gift_out' else 'gift_in' end;
  shared_cash_amount := case when payment_row.overpay_disposition = 'gift'
    then leg_row.shared_amount_minor else leg_row.cash_amount_minor end;
  shared_transaction := private.post_settlement_account_transaction(
    leg_row.owner_participant_id,
    private.settlement_cash_request_id(
      leg_row.settlement_allocation_id, leg_row.owner_participant_id,
      leg_row.role, 'shared'
    ),
    leg_row.settlement_allocation_id, leg_row.account_id, shared_kind,
    shared_cash_amount, payment_row.payment_date, 'Settlement cash'
  );
  if leg_row.gift_extra_minor > 0 then
    gift_transaction := private.post_settlement_account_transaction(
      leg_row.owner_participant_id,
      private.settlement_cash_request_id(
        leg_row.settlement_allocation_id, leg_row.owner_participant_id,
        leg_row.role, 'gift'
      ),
      leg_row.settlement_allocation_id, leg_row.account_id, gift_kind,
      leg_row.gift_extra_minor, payment_row.payment_date, 'Settlement gift extra'
    );
  end if;
  update public.personal_settlement_cash_legs
  set status = 'posted', posted_transaction_id = shared_transaction,
      gift_transaction_id = gift_transaction, posted_at = pg_catalog.now(),
      version = version + 1
  where id = leg_row.id;
end;
$$;

alter function public.respond_to_settlement(uuid, text, integer)
  rename to phase5_respond_to_settlement_without_cash;

revoke all on function public.phase5_respond_to_settlement_without_cash(
  uuid, text, integer
) from public, anon, authenticated;

create or replace function public.respond_to_settlement(
  target_allocation_id uuid,
  response text,
  expected_payment_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := public.current_participant_id();
  allocation_row public.settlement_allocations%rowtype;
  payment_row public.settlement_payments%rowtype;
  payer_leg public.personal_settlement_cash_legs%rowtype;
  receiver_leg public.personal_settlement_cash_legs%rowtype;
  phase5_result jsonb;
begin
  if actor is null then
    raise exception using message = 'not_authenticated', errcode = 'P0001';
  end if;
  select * into allocation_row from public.settlement_allocations
  where id = target_allocation_id for update;
  select * into payment_row from public.settlement_payments
  where id = allocation_row.settlement_payment_id for update;
  if allocation_row.id is null or payment_row.id is null then
    raise exception using message = 'allocation_not_found', errcode = 'P0001';
  end if;
  if allocation_row.creditor_participant_id <> actor then
    raise exception using message = 'allocation_write_denied', errcode = 'P0001';
  end if;
  if payment_row.cash_tracking_required and response = 'accepted'
     and allocation_row.state = 'pending' then
    select * into payer_leg from public.personal_settlement_cash_legs
    where settlement_allocation_id = allocation_row.id and role = 'payer'
      and owner_participant_id = payment_row.debtor_participant_id
      and status = 'pending';
    select * into receiver_leg from public.personal_settlement_cash_legs
    where settlement_allocation_id = allocation_row.id and role = 'receiver'
      and owner_participant_id = allocation_row.creditor_participant_id
      and status = 'pending';
    if payer_leg.id is null or receiver_leg.id is null then
      raise exception using message = 'settlement_cash_authorization_required', errcode = 'P0001';
    end if;
    if payer_leg.cash_amount_minor <> receiver_leg.cash_amount_minor
       or payer_leg.account_currency <> receiver_leg.account_currency then
      raise exception using message = 'settlement_cash_legs_mismatch', errcode = 'P0001';
    end if;
  end if;

  phase5_result := public.phase5_respond_to_settlement_without_cash(
    target_allocation_id, response, expected_payment_version
  );
  if payment_row.cash_tracking_required and allocation_row.state = 'pending' then
    if response = 'accepted' then
      perform private.post_personal_settlement_cash_leg(payer_leg.id);
      perform private.post_personal_settlement_cash_leg(receiver_leg.id);
    else
      update public.personal_settlement_cash_legs
      set status = 'cancelled', cancelled_at = pg_catalog.now(), version = version + 1
      where settlement_allocation_id = allocation_row.id and status = 'pending';
    end if;
  end if;
  return phase5_result;
end;
$$;

alter function public.cancel_pending_settlement_allocation(uuid, integer)
  rename to phase5_cancel_pending_settlement_allocation_without_cash;

revoke all on function public.phase5_cancel_pending_settlement_allocation_without_cash(
  uuid, integer
) from public, anon, authenticated;

create or replace function public.cancel_pending_settlement_allocation(
  target_allocation_id uuid,
  expected_payment_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result_payload jsonb;
begin
  result_payload := public.phase5_cancel_pending_settlement_allocation_without_cash(
    target_allocation_id, expected_payment_version
  );
  update public.personal_settlement_cash_legs
  set status = 'cancelled', cancelled_at = pg_catalog.now(), version = version + 1
  where settlement_allocation_id = target_allocation_id and status = 'pending';
  return result_payload;
end;
$$;

create or replace function private.reverse_settlement_account_transaction(
  target_owner_id uuid,
  request_id uuid,
  target_transaction_id uuid,
  occurred_on date,
  transaction_memo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_row public.personal_account_transactions%rowtype;
  existing_row public.personal_account_transactions%rowtype;
  fingerprint text;
  reversal_id uuid;
begin
  fingerprint := private.personal_payload_fingerprint(pg_catalog.jsonb_build_object(
    'kind', 'reversal', 'target_transaction_id', target_transaction_id,
    'occurred_on', occurred_on, 'memo', nullif(pg_catalog.btrim(transaction_memo), '')
  ));
  select * into existing_row from public.personal_account_transactions
  where owner_participant_id = target_owner_id and client_request_id = request_id;
  if existing_row.id is not null then
    if existing_row.payload_fingerprint <> fingerprint then
      raise exception using message = 'idempotency_conflict', errcode = 'P0001';
    end if;
    return existing_row.id;
  end if;
  select * into target_row from public.personal_account_transactions
  where id = target_transaction_id and owner_participant_id = target_owner_id for update;
  if target_row.id is null or target_row.reversal_transaction_id is not null
     or target_row.kind = 'reversal' then
    raise exception using message = 'settlement_cash_reversal_conflict', errcode = 'P0001';
  end if;
  insert into public.personal_account_transactions(
    owner_participant_id, client_request_id, payload_fingerprint,
    kind, occurred_on, memo, reverses_transaction_id
  ) values (
    target_owner_id, request_id, fingerprint, 'reversal', occurred_on,
    nullif(pg_catalog.btrim(transaction_memo), ''), target_transaction_id
  ) returning id into reversal_id;
  insert into public.personal_account_entries(
    transaction_id, account_id, amount_minor, currency
  ) select reversal_id, account_id, -amount_minor, currency
    from public.personal_account_entries where transaction_id = target_transaction_id;
  update public.personal_account_transactions
  set reversed_at = pg_catalog.now(), reversal_transaction_id = reversal_id,
      version = version + 1
  where id = target_transaction_id;
  update public.personal_accounts set version = version + 1
  where id in (select account_id from public.personal_account_entries
    where transaction_id = target_transaction_id);
  perform private.assert_personal_transaction_invariants(reversal_id);
  return reversal_id;
end;
$$;

create or replace function private.reverse_settlement_cash_legs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  leg_row public.personal_settlement_cash_legs%rowtype;
  shared_reversal uuid;
  gift_reversal uuid;
begin
  for leg_row in
    select * from public.personal_settlement_cash_legs
    where settlement_allocation_id = new.settlement_allocation_id
      and status = 'posted' for update
  loop
    shared_reversal := private.reverse_settlement_account_transaction(
      leg_row.owner_participant_id,
      private.settlement_cash_request_id(
        leg_row.settlement_allocation_id, leg_row.owner_participant_id,
        leg_row.role, 'shared-reversal'
      ), leg_row.posted_transaction_id, current_date, 'Settlement reversal'
    );
    gift_reversal := null;
    if leg_row.gift_transaction_id is not null then
      gift_reversal := private.reverse_settlement_account_transaction(
        leg_row.owner_participant_id,
        private.settlement_cash_request_id(
          leg_row.settlement_allocation_id, leg_row.owner_participant_id,
          leg_row.role, 'gift-reversal'
        ), leg_row.gift_transaction_id, current_date, 'Settlement gift reversal'
      );
    end if;
    update public.personal_settlement_cash_legs
    set status = 'reversed', posted_reversal_transaction_id = shared_reversal,
        gift_reversal_transaction_id = gift_reversal,
        reversed_at = pg_catalog.now(), version = version + 1
    where id = leg_row.id;
  end loop;
  return new;
end;
$$;

create trigger personal_settlement_cash_reverse_with_allocation
  after insert on public.settlement_allocation_reversals
  for each row execute function private.reverse_settlement_cash_legs();

revoke all on function private.direct_expense_obligation(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function private.direct_signed_outstanding(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.settlement_cash_request_id(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function private.post_settlement_account_transaction(uuid, uuid, uuid, uuid, text, bigint, date, text) from public, anon, authenticated;
revoke all on function private.post_personal_settlement_cash_leg(uuid) from public, anon, authenticated;
revoke all on function private.reverse_settlement_account_transaction(uuid, uuid, uuid, date, text) from public, anon, authenticated;
revoke all on function private.reverse_settlement_cash_legs() from public, anon, authenticated;

revoke all on function public.get_direct_outstanding(uuid, text) from public, anon, authenticated;
revoke all on function public.create_settlement_payment_request(uuid, uuid, text, uuid, text, bigint, text, timestamptz) from public, anon, authenticated;
revoke all on function public.cancel_settlement_payment_request(uuid, integer) from public, anon, authenticated;
revoke all on function public.propose_settlement(uuid, text, uuid, text, bigint, date, uuid[], bigint[], text, text, bigint, uuid[], bigint[], uuid) from public, anon, authenticated;
revoke all on function public.authorize_personal_settlement_cash_leg(uuid, uuid, text, uuid, bigint) from public, anon, authenticated;
revoke all on function public.respond_to_settlement(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.cancel_pending_settlement_allocation(uuid, integer) from public, anon, authenticated;

grant execute on function public.get_direct_outstanding(uuid, text) to authenticated;
grant execute on function public.create_settlement_payment_request(uuid, uuid, text, uuid, text, bigint, text, timestamptz) to authenticated;
grant execute on function public.cancel_settlement_payment_request(uuid, integer) to authenticated;
grant execute on function public.propose_settlement(uuid, text, uuid, text, bigint, date, uuid[], bigint[], text, text, bigint, uuid[], bigint[], uuid) to authenticated;
grant execute on function public.authorize_personal_settlement_cash_leg(uuid, uuid, text, uuid, bigint) to authenticated;
grant execute on function public.respond_to_settlement(uuid, text, integer) to authenticated;
grant execute on function public.cancel_pending_settlement_allocation(uuid, integer) to authenticated;

comment on table public.settlement_payment_requests is 'Non-financial repayment reminders; contains no personal account identifiers.';
comment on table public.settlement_attribution_intents is 'Immutable selected-bill metadata for one proposed settlement allocation.';
comment on table public.personal_settlement_cash_legs is 'Owner-private actual wallet movement for one shared allocation and role.';
comment on function public.authorize_personal_settlement_cash_leg(uuid, uuid, text, uuid, bigint) is 'Binds only the caller own account; account ids never enter shared settlement rows or responses.';
