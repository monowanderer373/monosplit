\set ON_ERROR_STOP on

create extension if not exists pgtap with schema extensions;
create extension if not exists dblink with schema extensions;

drop schema if exists phase5_concurrency cascade;
create schema phase5_concurrency;

create function phase5_concurrency.capture(
  auth_sub uuid,
  statement text,
  hold_milliseconds integer default 0
)
returns text
language plpgsql
as $$
declare
  result_text text;
begin
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', auth_sub,
      'is_anonymous', false
    )::text,
    true
  );
  begin
    execute statement into result_text;
    result_text := 'ok:' || coalesce(result_text, 'null');
  exception when others then
    result_text := 'error:' || sqlerrm;
  end;
  if hold_milliseconds > 0 then
    perform pg_catalog.pg_sleep(hold_milliseconds::numeric / 1000);
  end if;
  return result_text;
end;
$$;

create function phase5_concurrency.make_direct(
  expense_id uuid,
  request_id uuid,
  account_state text
)
returns void
language plpgsql
as $$
declare
  owner_participation uuid := pg_catalog.gen_random_uuid();
  other_participation uuid := pg_catalog.gen_random_uuid();
begin
  insert into public.expenses(
    id, client_request_id, scope, created_by, total_minor,
    participant_count, currency, description, category, occurred_on
  )
  values (
    expense_id,
    request_id,
    'direct',
    'fa100000-0000-4000-8000-000000000001',
    4000,
    2,
    'MYR',
    'Concurrency fixture',
    'Other',
    current_date
  );
  insert into public.expense_participations(
    id, expense_id, participant_id, name_snapshot, participant_order,
    state, tracking_mode
  )
  values
    (
      owner_participation,
      expense_id,
      'fa100000-0000-4000-8000-000000000001',
      'Concurrency Owner',
      0,
      'accepted',
      'tracked'
    ),
    (
      other_participation,
      expense_id,
      'fb200000-0000-4000-8000-000000000002',
      'Concurrency Approver',
      1,
      account_state,
      'tracked'
    );
  insert into public.payer_contributions(
    expense_participation_id, expense_id, amount_minor
  )
  values (owner_participation, expense_id, 4000);
  insert into public.expense_shares(
    expense_participation_id, expense_id, amount_minor
  )
  values
    (owner_participation, expense_id, 2000),
    (other_participation, expense_id, 2000);
end;
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'f1100000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'concurrency-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Concurrency Owner"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'f2200000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'concurrency-approver@example.test', '', now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Concurrency Approver"}', now(), now()
  );

update public.participants
set id = case auth_user_id
  when 'f1100000-0000-4000-8000-000000000001'
    then 'fa100000-0000-4000-8000-000000000001'::uuid
  else 'fb200000-0000-4000-8000-000000000002'::uuid
end
where auth_user_id in (
  'f1100000-0000-4000-8000-000000000001',
  'f2200000-0000-4000-8000-000000000002'
);

insert into public.friendships(
  participant_low_id, participant_high_id, requested_by, status, accepted_at
)
values (
  'fa100000-0000-4000-8000-000000000001',
  'fb200000-0000-4000-8000-000000000002',
  'fa100000-0000-4000-8000-000000000001',
  'accepted',
  now()
);

select extensions.dblink_connect(
  'phase5_s1',
  'dbname=postgres user=postgres'
);
select extensions.dblink_connect(
  'phase5_s2',
  'dbname=postgres user=postgres'
);

create temporary table race_results(
  race text primary key,
  session_one text not null,
  session_two text not null
);

select plan(17);

-- A. Ordinary Direct acceptance versus immediate owner cancellation.
select phase5_concurrency.make_direct(
  'f3010000-0000-4000-8000-000000000001',
  'f3110000-0000-4000-8000-000000000001',
  'pending'
);
select extensions.dblink_send_query(
  'phase5_s1',
  $remote$
    select phase5_concurrency.capture(
      'f2200000-0000-4000-8000-000000000002',
      $call$select public.respond_to_direct_expense(
        'f3010000-0000-4000-8000-000000000001',
        'accepted',
        1
      )::text$call$,
      500
    )
  $remote$
);
select extensions.dblink_send_query(
  'phase5_s2',
  $remote$
    select phase5_concurrency.capture(
      'f1100000-0000-4000-8000-000000000001',
      $call$select public.cancel_expense(
        'f3010000-0000-4000-8000-000000000001',
        1,
        null
      )::text$call$
    )
  $remote$
);
insert into race_results
select 'A', one.result, two.result
from extensions.dblink_get_result('phase5_s1') as one(result text)
cross join extensions.dblink_get_result('phase5_s2') as two(result text);
select * from extensions.dblink_get_result('phase5_s1') as drained(result text);
select * from extensions.dblink_get_result('phase5_s2') as drained(result text);
select ok(
  (
    select (session_one like 'ok:%') <> (session_two like 'ok:%')
    from race_results where race = 'A'
  ),
  'A: exactly one accept/cancel classification wins'
);
select ok(
  (
    select (
      expense.status = 'active' and participation.state = 'accepted'
    ) or (
      expense.status = 'voided' and participation.state = 'pending'
    )
    from public.expenses as expense
    join public.expense_participations as participation
      on participation.expense_id = expense.id
    where expense.id = 'f3010000-0000-4000-8000-000000000001'
      and participation.participant_id =
        'fb200000-0000-4000-8000-000000000002'
  ),
  'A: an accepted counterparty is never silently cancelled'
);

-- B. Final correction approval versus proposer withdrawal.
select phase5_concurrency.make_direct(
  'f3020000-0000-4000-8000-000000000002',
  'f3120000-0000-4000-8000-000000000002',
  'accepted'
);
select phase5_concurrency.capture(
  'f1100000-0000-4000-8000-000000000001',
  $call$select public.propose_direct_expense_change(
    'f3220000-0000-4000-8000-000000000002',
    'f3020000-0000-4000-8000-000000000002',
    1,
    'correction',
    null,
    3000,
    'MYR',
    'Race B replacement',
    'Other',
    current_date,
    array[
      'fa100000-0000-4000-8000-000000000001'::uuid,
      'fb200000-0000-4000-8000-000000000002'::uuid
    ],
    array[3000::bigint, 0],
    array[1500::bigint, 1500]
  )::text$call$
);
select extensions.dblink_send_query(
  'phase5_s1',
  pg_catalog.format(
    $remote$select phase5_concurrency.capture(
      'f2200000-0000-4000-8000-000000000002',
      %L,
      500
    )$remote$,
    pg_catalog.format(
      'select public.respond_to_direct_expense_change(%L, %L, 1)::text',
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'f3220000-0000-4000-8000-000000000002'
      ),
      'accepted'
    )
  )
);
select extensions.dblink_send_query(
  'phase5_s2',
  pg_catalog.format(
    $remote$select phase5_concurrency.capture(
      'f1100000-0000-4000-8000-000000000001',
      %L
    )$remote$,
    pg_catalog.format(
      'select public.cancel_direct_expense_change(%L, 1)::text',
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'f3220000-0000-4000-8000-000000000002'
      )
    )
  )
);
insert into race_results
select 'B', one.result, two.result
from extensions.dblink_get_result('phase5_s1') as one(result text)
cross join extensions.dblink_get_result('phase5_s2') as two(result text);
select * from extensions.dblink_get_result('phase5_s1') as drained(result text);
select * from extensions.dblink_get_result('phase5_s2') as drained(result text);
select ok(
  (
    select (session_one like 'ok:%') <> (session_two like 'ok:%')
    from race_results where race = 'B'
  ),
  'B: final authority and proposer cancellation serialize'
);
select ok(
  (
    select (
      request.state = 'authoritative'
      and original.status = 'voided'
      and replacement.status = 'active'
      and replacement.corrects_expense_id = original.id
    ) or (
      request.state = 'cancelled'
      and original.status = 'active'
      and replacement.status = 'voided'
      and replacement.corrects_expense_id is null
    )
    from public.direct_expense_change_requests as request
    join public.expenses as original on original.id = request.target_expense_id
    join public.expenses as replacement
      on replacement.id = request.replacement_expense_id
    where request.client_request_id =
      'f3220000-0000-4000-8000-000000000002'
  ),
  'B: committed state always has exactly one authoritative Expense'
);

-- C. Two correction proposals for one target.
select phase5_concurrency.make_direct(
  'f3030000-0000-4000-8000-000000000003',
  'f3130000-0000-4000-8000-000000000003',
  'accepted'
);
select extensions.dblink_send_query(
  'phase5_s1',
  $remote$
    select phase5_concurrency.capture(
      'f1100000-0000-4000-8000-000000000001',
      $call$select public.propose_direct_expense_change(
        'f3230000-0000-4000-8000-000000000003',
        'f3030000-0000-4000-8000-000000000003',
        1, 'correction', null, 3000, 'MYR', 'Race C one', 'Other',
        current_date,
        array[
          'fa100000-0000-4000-8000-000000000001'::uuid,
          'fb200000-0000-4000-8000-000000000002'::uuid
        ],
        array[3000::bigint, 0],
        array[1500::bigint, 1500]
      )::text$call$,
      500
    )
  $remote$
);
select extensions.dblink_send_query(
  'phase5_s2',
  $remote$
    select phase5_concurrency.capture(
      'f1100000-0000-4000-8000-000000000001',
      $call$select public.propose_direct_expense_change(
        'f3330000-0000-4000-8000-000000000003',
        'f3030000-0000-4000-8000-000000000003',
        1, 'correction', null, 3500, 'MYR', 'Race C two', 'Other',
        current_date,
        array[
          'fa100000-0000-4000-8000-000000000001'::uuid,
          'fb200000-0000-4000-8000-000000000002'::uuid
        ],
        array[3500::bigint, 0],
        array[1750::bigint, 1750]
      )::text$call$
    )
  $remote$
);
insert into race_results
select 'C', one.result, two.result
from extensions.dblink_get_result('phase5_s1') as one(result text)
cross join extensions.dblink_get_result('phase5_s2') as two(result text);
select * from extensions.dblink_get_result('phase5_s1') as drained(result text);
select * from extensions.dblink_get_result('phase5_s2') as drained(result text);
select ok(
  (
    select (session_one like 'ok:%') <> (session_two like 'ok:%')
    from race_results where race = 'C'
  ),
  'C: only one competing correction proposal succeeds'
);
select is(
  (
    select count(*)::integer
    from public.direct_expense_change_requests
    where target_expense_id =
      'f3030000-0000-4000-8000-000000000003'
      and state = 'pending'
  ),
  1,
  'C: one pending branch exists structurally'
);

-- D. Correction request versus cancellation request.
select phase5_concurrency.make_direct(
  'f3040000-0000-4000-8000-000000000004',
  'f3140000-0000-4000-8000-000000000004',
  'accepted'
);
select extensions.dblink_send_query(
  'phase5_s1',
  $remote$
    select phase5_concurrency.capture(
      'f1100000-0000-4000-8000-000000000001',
      $call$select public.propose_direct_expense_change(
        'f3240000-0000-4000-8000-000000000004',
        'f3040000-0000-4000-8000-000000000004',
        1, 'correction', null, 3000, 'MYR', 'Race D correction', 'Other',
        current_date,
        array[
          'fa100000-0000-4000-8000-000000000001'::uuid,
          'fb200000-0000-4000-8000-000000000002'::uuid
        ],
        array[3000::bigint, 0],
        array[1500::bigint, 1500]
      )::text$call$,
      500
    )
  $remote$
);
select extensions.dblink_send_query(
  'phase5_s2',
  $remote$
    select phase5_concurrency.capture(
      'f1100000-0000-4000-8000-000000000001',
      $call$select public.propose_direct_expense_change(
        'f3340000-0000-4000-8000-000000000004',
        'f3040000-0000-4000-8000-000000000004',
        1, 'cancellation'
      )::text$call$
    )
  $remote$
);
insert into race_results
select 'D', one.result, two.result
from extensions.dblink_get_result('phase5_s1') as one(result text)
cross join extensions.dblink_get_result('phase5_s2') as two(result text);
select * from extensions.dblink_get_result('phase5_s1') as drained(result text);
select * from extensions.dblink_get_result('phase5_s2') as drained(result text);
select ok(
  (
    select (session_one like 'ok:%') <> (session_two like 'ok:%')
    from race_results where race = 'D'
  ),
  'D: correction and cancellation proposals serialize'
);
select is(
  (
    select count(*)::integer
    from public.direct_expense_change_requests
    where target_expense_id =
      'f3040000-0000-4000-8000-000000000004'
      and state = 'pending'
  ),
  1,
  'D: one authority request owns the target'
);

-- E. Settlement acceptance versus debtor cancellation.
select phase5_concurrency.capture(
  'f1100000-0000-4000-8000-000000000001',
  $call$select public.propose_settlement(
    'f4050000-0000-4000-8000-000000000005',
    'direct',
    null,
    'MYR',
    1000,
    current_date,
    array['fb200000-0000-4000-8000-000000000002'::uuid],
    array[1000::bigint],
    null
  )::text$call$
);
select extensions.dblink_send_query(
  'phase5_s1',
  pg_catalog.format(
    $remote$select phase5_concurrency.capture(
      'f2200000-0000-4000-8000-000000000002',
      %L,
      500
    )$remote$,
    pg_catalog.format(
      'select public.respond_to_settlement(%L, %L, 1)::text',
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'f4050000-0000-4000-8000-000000000005'
      ),
      'accepted'
    )
  )
);
select extensions.dblink_send_query(
  'phase5_s2',
  pg_catalog.format(
    $remote$select phase5_concurrency.capture(
      'f1100000-0000-4000-8000-000000000001',
      %L
    )$remote$,
    pg_catalog.format(
      'select public.cancel_pending_settlement_allocation(%L, 1)::text',
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'f4050000-0000-4000-8000-000000000005'
      )
    )
  )
);
insert into race_results
select 'E', one.result, two.result
from extensions.dblink_get_result('phase5_s1') as one(result text)
cross join extensions.dblink_get_result('phase5_s2') as two(result text);
select * from extensions.dblink_get_result('phase5_s1') as drained(result text);
select * from extensions.dblink_get_result('phase5_s2') as drained(result text);
select ok(
  (
    select (session_one like 'ok:%') <> (session_two like 'ok:%')
    from race_results where race = 'E'
  ),
  'E: exactly one settlement accept/cancel intent wins'
);
select ok(
  (
    select allocation.state in ('accepted', 'cancelled')
      and payment.version = 2
      and (
        (allocation.state = 'accepted' and payment.status = 'confirmed')
        or (allocation.state = 'cancelled' and payment.status = 'cancelled')
      )
    from public.settlement_allocations as allocation
    join public.settlement_payments as payment
      on payment.id = allocation.settlement_payment_id
    where payment.client_request_id =
      'f4050000-0000-4000-8000-000000000005'
  ),
  'E: stale cancellation cannot overwrite accepted T'
);

-- F. Two different reversal requests for one immutable acceptance.
select phase5_concurrency.capture(
  'f1100000-0000-4000-8000-000000000001',
  $call$select public.propose_settlement(
    'f4060000-0000-4000-8000-000000000006',
    'direct',
    null,
    'MYR',
    1000,
    current_date,
    array['fb200000-0000-4000-8000-000000000002'::uuid],
    array[1000::bigint],
    null
  )::text$call$
);
select phase5_concurrency.capture(
  'f2200000-0000-4000-8000-000000000002',
  pg_catalog.format(
    'select public.respond_to_settlement(%L, %L, 1)::text',
    (
      select allocation.id
      from public.settlement_allocations as allocation
      join public.settlement_payments as payment
        on payment.id = allocation.settlement_payment_id
      where payment.client_request_id =
        'f4060000-0000-4000-8000-000000000006'
    ),
    'accepted'
  )
);
select extensions.dblink_send_query(
  'phase5_s1',
  pg_catalog.format(
    $remote$select phase5_concurrency.capture(
      'f2200000-0000-4000-8000-000000000002',
      %L,
      500
    )$remote$,
    pg_catalog.format(
      'select public.reverse_settlement_allocation(%L, %L, 2, null)::text',
      'f4160000-0000-4000-8000-000000000006',
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'f4060000-0000-4000-8000-000000000006'
      )
    )
  )
);
select extensions.dblink_send_query(
  'phase5_s2',
  pg_catalog.format(
    $remote$select phase5_concurrency.capture(
      'f2200000-0000-4000-8000-000000000002',
      %L
    )$remote$,
    pg_catalog.format(
      'select public.reverse_settlement_allocation(%L, %L, 2, null)::text',
      'f4260000-0000-4000-8000-000000000006',
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'f4060000-0000-4000-8000-000000000006'
      )
    )
  )
);
insert into race_results
select 'F', one.result, two.result
from extensions.dblink_get_result('phase5_s1') as one(result text)
cross join extensions.dblink_get_result('phase5_s2') as two(result text);
select * from extensions.dblink_get_result('phase5_s1') as drained(result text);
select * from extensions.dblink_get_result('phase5_s2') as drained(result text);
select ok(
  (
    select (session_one like 'ok:%') <> (session_two like 'ok:%')
    from race_results where race = 'F'
  ),
  'F: only one concurrent full reversal succeeds'
);
select is(
  (
    select count(*)::integer
    from public.settlement_allocation_reversals as reversal
    join public.settlement_allocations as allocation
      on allocation.id = reversal.settlement_allocation_id
    join public.settlement_payments as payment
      on payment.id = allocation.settlement_payment_id
    where payment.client_request_id =
      'f4060000-0000-4000-8000-000000000006'
  ),
  1,
  'F: exactly one immutable R fact exists'
);
select is(
  (
    select allocation.state
    from public.settlement_allocations as allocation
    join public.settlement_payments as payment
      on payment.id = allocation.settlement_payment_id
    where payment.client_request_id =
      'f4060000-0000-4000-8000-000000000006'
  ),
  'accepted',
  'F: reversal never mutates the accepted allocation'
);

-- G. Correction authority and settlement acceptance commute. Scenario one
-- holds the Expense transaction so the Settlement transaction commits first.
select phase5_concurrency.make_direct(
  'f3070000-0000-4000-8000-000000000007',
  'f3170000-0000-4000-8000-000000000007',
  'accepted'
);
select phase5_concurrency.capture(
  'f1100000-0000-4000-8000-000000000001',
  $call$select public.propose_direct_expense_change(
    'f3270000-0000-4000-8000-000000000007',
    'f3070000-0000-4000-8000-000000000007',
    1, 'correction', null, 4000, 'MYR', 'Race G one', 'Other',
    current_date,
    array[
      'fa100000-0000-4000-8000-000000000001'::uuid,
      'fb200000-0000-4000-8000-000000000002'::uuid
    ],
    array[4000::bigint, 0],
    array[2000::bigint, 2000]
  )::text$call$
);
select phase5_concurrency.capture(
  'f2200000-0000-4000-8000-000000000002',
  $call$select public.propose_settlement(
    'f4070000-0000-4000-8000-000000000007',
    'direct',
    null,
    'MYR',
    1000,
    current_date,
    array['fa100000-0000-4000-8000-000000000001'::uuid],
    array[1000::bigint],
    null
  )::text$call$
);
select extensions.dblink_send_query(
  'phase5_s1',
  pg_catalog.format(
    $remote$select phase5_concurrency.capture(
      'f2200000-0000-4000-8000-000000000002',
      %L,
      700
    )$remote$,
    pg_catalog.format(
      'select public.respond_to_direct_expense_change(%L, %L, 1)::text',
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'f3270000-0000-4000-8000-000000000007'
      ),
      'accepted'
    )
  )
);
select extensions.dblink_send_query(
  'phase5_s2',
  pg_catalog.format(
    $remote$select phase5_concurrency.capture(
      'f1100000-0000-4000-8000-000000000001',
      %L
    )$remote$,
    pg_catalog.format(
      'select public.respond_to_settlement(%L, %L, 1)::text',
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'f4070000-0000-4000-8000-000000000007'
      ),
      'accepted'
    )
  )
);
insert into race_results
select 'G1', one.result, two.result
from extensions.dblink_get_result('phase5_s1') as one(result text)
cross join extensions.dblink_get_result('phase5_s2') as two(result text);
select * from extensions.dblink_get_result('phase5_s1') as drained(result text);
select * from extensions.dblink_get_result('phase5_s2') as drained(result text);
select ok(
  (
    select session_one like 'ok:%' and session_two like 'ok:%'
    from race_results where race = 'G1'
  ),
  'G: settlement-first and correction-second both commit'
);
select is(
  (
    select
      (
        select share.amount_minor
          - coalesce(contribution.amount_minor, 0)
        from public.expenses as expense
        join public.expense_participations as participation
          on participation.expense_id = expense.id
        join public.expense_shares as share
          on share.expense_participation_id = participation.id
        left join public.payer_contributions as contribution
          on contribution.expense_participation_id = participation.id
        where expense.status = 'active'
          and expense.corrects_expense_id =
            'f3070000-0000-4000-8000-000000000007'
          and participation.participant_id =
            'fb200000-0000-4000-8000-000000000002'
      )
      -
      (
        select allocation.amount_minor
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'f4070000-0000-4000-8000-000000000007'
          and allocation.state = 'accepted'
      )
  )::bigint,
  1000::bigint,
  'G: settlement-first yields F = E - T + R = 1000'
);

-- Scenario two holds Settlement acceptance so correction commits first.
select phase5_concurrency.make_direct(
  'f3080000-0000-4000-8000-000000000008',
  'f3180000-0000-4000-8000-000000000008',
  'accepted'
);
select phase5_concurrency.capture(
  'f1100000-0000-4000-8000-000000000001',
  $call$select public.propose_direct_expense_change(
    'f3280000-0000-4000-8000-000000000008',
    'f3080000-0000-4000-8000-000000000008',
    1, 'correction', null, 4000, 'MYR', 'Race G two', 'Other',
    current_date,
    array[
      'fa100000-0000-4000-8000-000000000001'::uuid,
      'fb200000-0000-4000-8000-000000000002'::uuid
    ],
    array[4000::bigint, 0],
    array[2000::bigint, 2000]
  )::text$call$
);
select phase5_concurrency.capture(
  'f2200000-0000-4000-8000-000000000002',
  $call$select public.propose_settlement(
    'f4080000-0000-4000-8000-000000000008',
    'direct',
    null,
    'MYR',
    1000,
    current_date,
    array['fa100000-0000-4000-8000-000000000001'::uuid],
    array[1000::bigint],
    null
  )::text$call$
);
select extensions.dblink_send_query(
  'phase5_s1',
  pg_catalog.format(
    $remote$select phase5_concurrency.capture(
      'f1100000-0000-4000-8000-000000000001',
      %L,
      700
    )$remote$,
    pg_catalog.format(
      'select public.respond_to_settlement(%L, %L, 1)::text',
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'f4080000-0000-4000-8000-000000000008'
      ),
      'accepted'
    )
  )
);
select extensions.dblink_send_query(
  'phase5_s2',
  pg_catalog.format(
    $remote$select phase5_concurrency.capture(
      'f2200000-0000-4000-8000-000000000002',
      %L
    )$remote$,
    pg_catalog.format(
      'select public.respond_to_direct_expense_change(%L, %L, 1)::text',
      (
        select id from public.direct_expense_change_requests
        where client_request_id =
          'f3280000-0000-4000-8000-000000000008'
      ),
      'accepted'
    )
  )
);
insert into race_results
select 'G2', one.result, two.result
from extensions.dblink_get_result('phase5_s1') as one(result text)
cross join extensions.dblink_get_result('phase5_s2') as two(result text);
select * from extensions.dblink_get_result('phase5_s1') as drained(result text);
select * from extensions.dblink_get_result('phase5_s2') as drained(result text);
select ok(
  (
    select session_one like 'ok:%' and session_two like 'ok:%'
    from race_results where race = 'G2'
  ),
  'G: correction-first and settlement-second both commit'
);
select is(
  (
    select
      (
        select share.amount_minor
          - coalesce(contribution.amount_minor, 0)
        from public.expenses as expense
        join public.expense_participations as participation
          on participation.expense_id = expense.id
        join public.expense_shares as share
          on share.expense_participation_id = participation.id
        left join public.payer_contributions as contribution
          on contribution.expense_participation_id = participation.id
        where expense.status = 'active'
          and expense.corrects_expense_id =
            'f3080000-0000-4000-8000-000000000008'
          and participation.participant_id =
            'fb200000-0000-4000-8000-000000000002'
      )
      -
      (
        select allocation.amount_minor
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id =
          'f4080000-0000-4000-8000-000000000008'
          and allocation.state = 'accepted'
      )
  )::bigint,
  1000::bigint,
  'G: correction-first yields the same F = E - T + R = 1000'
);

select * from finish();

select extensions.dblink_disconnect('phase5_s1');
select extensions.dblink_disconnect('phase5_s2');

-- Keep the local database reusable when the harness succeeds.
delete from public.financial_events
where actor_participant_id in (
  'fa100000-0000-4000-8000-000000000001',
  'fb200000-0000-4000-8000-000000000002'
);
delete from public.settlement_allocation_reversals
where reversed_by = 'fb200000-0000-4000-8000-000000000002';
delete from public.settlement_allocations
where settlement_payment_id in (
  select id from public.settlement_payments
  where debtor_participant_id in (
    'fa100000-0000-4000-8000-000000000001',
    'fb200000-0000-4000-8000-000000000002'
  )
);
delete from public.settlement_payments
where debtor_participant_id in (
  'fa100000-0000-4000-8000-000000000001',
  'fb200000-0000-4000-8000-000000000002'
);
delete from public.direct_expense_change_approvals
where request_id in (
  select id from public.direct_expense_change_requests
  where proposed_by = 'fa100000-0000-4000-8000-000000000001'
);
delete from public.direct_expense_change_requests
where proposed_by = 'fa100000-0000-4000-8000-000000000001';
delete from public.payer_contributions
where expense_id in (
  select id from public.expenses
  where created_by = 'fa100000-0000-4000-8000-000000000001'
);
delete from public.expense_shares
where expense_id in (
  select id from public.expenses
  where created_by = 'fa100000-0000-4000-8000-000000000001'
);
delete from public.expense_participations
where expense_id in (
  select id from public.expenses
  where created_by = 'fa100000-0000-4000-8000-000000000001'
);
delete from public.expenses
where created_by = 'fa100000-0000-4000-8000-000000000001';
delete from public.friendships
where participant_low_id = 'fa100000-0000-4000-8000-000000000001'
  and participant_high_id = 'fb200000-0000-4000-8000-000000000002';
delete from public.person_relationships
where owner_participant_id in (
  'fa100000-0000-4000-8000-000000000001',
  'fb200000-0000-4000-8000-000000000002'
);
delete from public.participants
where id in (
  'fa100000-0000-4000-8000-000000000001',
  'fb200000-0000-4000-8000-000000000002'
);
delete from auth.users
where id in (
  'f1100000-0000-4000-8000-000000000001',
  'f2200000-0000-4000-8000-000000000002'
);
drop schema phase5_concurrency cascade;
drop extension dblink;
drop extension pgtap;
