begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '91000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'compat-debtor@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Debtor"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '92000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'compat-creditor@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Creditor"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '93000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'compat-stranger@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Stranger"}',
    now(), now()
  );

update public.participants
set id = case auth_user_id
  when '91000000-0000-4000-8000-000000000001'
    then 'a9100000-0000-4000-8000-000000000001'::uuid
  when '92000000-0000-4000-8000-000000000002'
    then 'b9200000-0000-4000-8000-000000000002'::uuid
  when '93000000-0000-4000-8000-000000000003'
    then 'c9300000-0000-4000-8000-000000000003'::uuid
end
where auth_user_id in (
  '91000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000002',
  '93000000-0000-4000-8000-000000000003'
);

insert into public.friendships(
  participant_low_id, participant_high_id, requested_by, status, accepted_at
) values (
  'a9100000-0000-4000-8000-000000000001',
  'b9200000-0000-4000-8000-000000000002',
  'a9100000-0000-4000-8000-000000000001',
  'accepted',
  now()
);

select is(
  pg_catalog.to_regprocedure('public.respond_to_settlement(uuid,text)') is not null,
  true,
  'legacy two-argument settlement response exists'
);
select is(
  pg_catalog.to_regprocedure('public.respond_to_settlement(uuid,text,integer)') is not null,
  true,
  'version-aware settlement response remains canonical'
);
select is(
  pg_catalog.pg_get_function_result('public.respond_to_settlement(uuid,text)'::regprocedure),
  'text'::text,
  'legacy overload returns the historical status text'
);
select is(
  pg_catalog.pg_get_function_result('public.respond_to_settlement(uuid,text,integer)'::regprocedure),
  'jsonb'::text,
  'version-aware overload returns jsonb'
);
select is(
  pg_catalog.has_function_privilege(
    'authenticated', 'public.respond_to_settlement(uuid,text)', 'EXECUTE'
  ),
  true,
  'authenticated clients can execute the legacy settlement response'
);
select is(
  pg_catalog.has_function_privilege(
    'anon', 'public.respond_to_settlement(uuid,text)', 'EXECUTE'
  ),
  false,
  'anonymous clients cannot execute the legacy settlement response'
);
select is(
  (
    select count(*)::integer
    from pg_catalog.aclexplode(proc.proacl) as acl
    where acl.privilege_type = 'EXECUTE'
      and acl.grantee = 0
  ),
  0,
  'legacy overload is not granted to public'
)
from pg_catalog.pg_proc as proc
where proc.oid = 'public.respond_to_settlement(uuid,text)'::regprocedure;
select is(
  pg_catalog.has_function_privilege(
    'authenticated', 'public.respond_to_settlement(uuid,text,integer)', 'EXECUTE'
  ),
  true,
  'authenticated clients can execute the version-aware settlement response'
);
select is(
  pg_catalog.has_function_privilege(
    'anon', 'public.respond_to_settlement(uuid,text,integer)', 'EXECUTE'
  ),
  false,
  'anonymous clients cannot execute the version-aware settlement response'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"91000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok(
  $$
    select public.create_expense(
      'c2400000-0000-4000-8000-0000000000e1',
      'direct',
      null,
      12000,
      'MYR',
      'Compat dinner',
      'Food',
      current_date,
      array[
        'a9100000-0000-4000-8000-000000000001'::uuid,
        'b9200000-0000-4000-8000-000000000002'::uuid
      ],
      array[0::bigint, 12000::bigint],
      array[6000::bigint, 6000::bigint]
    )
  $$,
  'a Direct bill creates debt the legacy client can settle'
);

select lives_ok(
  $$
    select public.propose_settlement(
      request_id, 'direct', null, 'MYR', 1000, current_date,
      array['b9200000-0000-4000-8000-000000000002'::uuid],
      array[1000::bigint],
      null
    )
    from (
      values
        ('c2400000-0000-4000-8000-000000000011'::uuid),
        ('c2400000-0000-4000-8000-000000000012'::uuid),
        ('c2400000-0000-4000-8000-000000000013'::uuid),
        ('c2400000-0000-4000-8000-000000000014'::uuid),
        ('c2400000-0000-4000-8000-000000000015'::uuid),
        ('c2400000-0000-4000-8000-000000000016'::uuid)
    ) as requests(request_id)
  $$,
  'the debtor can propose six pending settlements with the historical signature'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"92000000-0000-4000-8000-000000000002","is_anonymous":false}';

select results_eq(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id = 'c2400000-0000-4000-8000-000000000011'
      ),
      'accepted'
    )
  $$,
  $$ values ('confirmed'::text) $$,
  'legacy accept returns the parent status text'
);
select results_eq(
  $$
    select allocation.state, payment.status, payment.version
    from public.settlement_allocations as allocation
    join public.settlement_payments as payment
      on payment.id = allocation.settlement_payment_id
    where payment.client_request_id = 'c2400000-0000-4000-8000-000000000011'
  $$,
  $$ values ('accepted'::text, 'confirmed'::text, 2::integer) $$,
  'legacy accept delegates to the versioned writer'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.financial_events as event
    join public.settlement_payments as payment
      on payment.id = event.settlement_payment_id
    where payment.client_request_id = 'c2400000-0000-4000-8000-000000000011'
      and event.event_type = 'settlement.allocation_accepted'
  $$,
  $$ values (1::bigint) $$,
  'legacy accept appends one financial event'
);
select throws_ok(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id = 'c2400000-0000-4000-8000-000000000011'
      ),
      'accepted'
    )
  $$,
  'P0001',
  'allocation_not_pending',
  'a second legacy accept cannot also succeed'
);
select results_eq(
  $$
    select allocation.state, payment.version, count(event.id)::bigint
    from public.settlement_allocations as allocation
    join public.settlement_payments as payment
      on payment.id = allocation.settlement_payment_id
    left join public.financial_events as event
      on event.settlement_payment_id = payment.id
    where payment.client_request_id = 'c2400000-0000-4000-8000-000000000011'
    group by allocation.state, payment.version
  $$,
  $$ values ('accepted'::text, 2::integer, 2::bigint) $$,
  'a rejected legacy retry leaves history append-only'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.settlement_allocation_reversals as reversal
    join public.settlement_allocations as allocation
      on allocation.id = reversal.settlement_allocation_id
    join public.settlement_payments as payment
      on payment.id = allocation.settlement_payment_id
    where payment.client_request_id = 'c2400000-0000-4000-8000-000000000011'
  $$,
  $$ values (0::bigint) $$,
  'legacy accept does not rewrite accepted history with a reversal'
);
select results_eq(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id = 'c2400000-0000-4000-8000-000000000012'
      ),
      'declined'
    )
  $$,
  $$ values ('declined'::text) $$,
  'legacy reject returns the parent status text'
);
select throws_ok(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id = 'c2400000-0000-4000-8000-000000000012'
      ),
      'accepted'
    )
  $$,
  'P0001',
  'allocation_not_pending',
  'a declined settlement cannot be silently accepted later'
);
select results_eq(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id = 'c2400000-0000-4000-8000-000000000013'
      ),
      'accepted',
      1
    )
  $$,
  $$ values (
    pg_catalog.jsonb_build_object(
      'allocation_state', 'accepted',
      'payment_status', 'confirmed',
      'payment_version', 2
    )
  ) $$,
  'version-aware accept returns the canonical jsonb result'
);
select results_eq(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id = 'c2400000-0000-4000-8000-000000000014'
      ),
      'declined',
      1
    ) ->> 'payment_status'
  $$,
  $$ values ('declined'::text) $$,
  'version-aware reject closes the settlement'
);
select throws_ok(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id = 'c2400000-0000-4000-8000-000000000015'
      ),
      'accepted',
      99
    )
  $$,
  'P0001',
  'version_conflict',
  'a stale expected version is rejected'
);
select results_eq(
  $$
    select allocation.state, payment.version
    from public.settlement_allocations as allocation
    join public.settlement_payments as payment
      on payment.id = allocation.settlement_payment_id
    where payment.client_request_id = 'c2400000-0000-4000-8000-000000000015'
  $$,
  $$ values ('pending'::text, 1::integer) $$,
  'a stale version-aware response does not change the settlement'
);

reset role;
select pg_catalog.set_config(
  'compat.unrelated_allocation_id',
  (
    select allocation.id::text
    from public.settlement_allocations as allocation
    join public.settlement_payments as payment
      on payment.id = allocation.settlement_payment_id
    where payment.client_request_id = 'c2400000-0000-4000-8000-000000000016'
  ),
  true
);
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"93000000-0000-4000-8000-000000000003","is_anonymous":false}';
select throws_ok(
  $$
    select public.respond_to_settlement(
      pg_catalog.current_setting('compat.unrelated_allocation_id')::uuid,
      'accepted'
    )
  $$,
  'P0001',
  'allocation_write_denied',
  'an unrelated participant cannot respond'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"91000000-0000-4000-8000-000000000001","is_anonymous":false}';
select throws_ok(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id = 'c2400000-0000-4000-8000-000000000016'
      ),
      'accepted'
    )
  $$,
  'P0001',
  'allocation_write_denied',
  'the payer cannot accept their own settlement allocation'
);
select throws_ok(
  $$
    select public.respond_to_settlement(
      (
        select allocation.id
        from public.settlement_allocations as allocation
        join public.settlement_payments as payment
          on payment.id = allocation.settlement_payment_id
        where payment.client_request_id = 'c2400000-0000-4000-8000-000000000016'
      ),
      'void'
    )
  $$,
  'P0001',
  'invalid_response',
  'legacy response values stay limited to accepted and declined'
);

reset role;
set local role anon;
select throws_ok(
  $$
    select public.respond_to_settlement(
      'c2400000-0000-4000-8000-0000000000ff'::uuid,
      'accepted'
    )
  $$,
  '42501',
  'permission denied for function respond_to_settlement',
  'anonymous clients are denied before any settlement row is read'
);

select * from finish();
rollback;
