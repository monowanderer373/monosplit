begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'abuse-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Abuse Owner"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '20000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'abuse-full@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Abuse Full"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '30000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'abuse-view@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Abuse View"}', now(), now()
  ),
  (
    '00000000-0000-0000-8000-000000000004',
    '40000000-0000-4000-8000-000000000004',
    'authenticated', 'authenticated', 'abuse-stranger@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Abuse Stranger"}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '50000000-0000-4000-8000-000000000005',
    'authenticated', 'authenticated', null, '', null,
    '{"provider":"anonymous","providers":[]}', '{}', now(), now()
  );

update public.participants
set id = case auth_user_id
  when '10000000-0000-4000-8000-000000000001' then 'a0000000-0000-4000-8000-000000000001'::uuid
  when '20000000-0000-4000-8000-000000000002' then 'b0000000-0000-4000-8000-000000000002'::uuid
  when '30000000-0000-4000-8000-000000000003' then 'c0000000-0000-4000-8000-000000000003'::uuid
  when '40000000-0000-4000-8000-000000000004' then 'd0000000-0000-4000-8000-000000000004'::uuid
  when '50000000-0000-4000-8000-000000000005' then 'e0000000-0000-4000-8000-000000000005'::uuid
end
where auth_user_id in (
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004',
  '50000000-0000-4000-8000-000000000005'
);

insert into public.spaces(id, type, name, owner_participant_id, default_currency)
values (
  'f0000000-0000-4000-8000-000000000001',
  'trip',
  'Private beta abuse fixture',
  'a0000000-0000-4000-8000-000000000001',
  'MYR'
);

insert into public.space_members(space_id, participant_id, role)
values
  ('f0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'owner'),
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002', 'full_access'),
  ('f0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'view');

insert into public.space_invites(token_digest, space_id, role, created_by, expires_at)
values (
  extensions.digest('anonymous-full-access-abuse', 'sha256'),
  'f0000000-0000-4000-8000-000000000001',
  'full_access',
  'a0000000-0000-4000-8000-000000000001',
  now() + interval '1 day'
);

insert into public.friendships(
  participant_low_id, participant_high_id, requested_by, status, accepted_at
)
values (
  'a0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000001',
  'accepted',
  now()
);

insert into public.expenses(
  id, client_request_id, scope, space_id, created_by, total_minor,
  participant_count, currency, description, category, occurred_on
)
values
  (
    '91000000-0000-4000-8000-000000000001',
    '91100000-0000-4000-8000-000000000001',
    'personal', null, 'a0000000-0000-4000-8000-000000000001',
    1000, 1, 'MYR', 'Guessed private expense', 'Other', current_date
  ),
  (
    '92000000-0000-4000-8000-000000000002',
    '92200000-0000-4000-8000-000000000002',
    'direct', null, 'a0000000-0000-4000-8000-000000000001',
    2000, 2, 'MYR', 'Guessed direct expense', 'Other', current_date
  );

insert into public.expense_participations(
  id, expense_id, participant_id, name_snapshot, participant_order, state, tracking_mode
)
values
  (
    '93100000-0000-4000-8000-000000000001',
    '91000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001',
    'Abuse Owner', 0, 'accepted', 'tracked'
  ),
  (
    '93200000-0000-4000-8000-000000000002',
    '92000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000001',
    'Abuse Owner', 0, 'accepted', 'tracked'
  ),
  (
    '93300000-0000-4000-8000-000000000003',
    '92000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000002',
    'Abuse Full', 1, 'accepted', 'tracked'
  );

insert into public.payer_contributions(expense_participation_id, expense_id, amount_minor)
values
  ('93100000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 1000),
  ('93200000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', 2000);

insert into public.expense_shares(expense_participation_id, expense_id, amount_minor)
values
  ('93100000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 1000),
  ('93200000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000002', 1000),
  ('93300000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000002', 1000);

-- Each block below runs with the same non-admin role/JWT shape used by
-- authenticated PostgREST RPC calls.
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"50000000-0000-4000-8000-000000000005","is_anonymous":true}';

select throws_ok(
  $$ select public.accept_space_invite('anonymous-full-access-abuse') $$,
  'P0001',
  'anonymous_full_access_invite_denied',
  'an anonymous session cannot accept a full-access invite'
);

reset role;
select results_eq(
  $$
    select count(*)::bigint
    from public.space_members
    where space_id = 'f0000000-0000-4000-8000-000000000001'
      and participant_id = 'e0000000-0000-4000-8000-000000000005'
  $$,
  $$ values (0::bigint) $$,
  'a rejected anonymous full-access invite adds no member'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.space_invites
    where token_digest = extensions.digest('anonymous-full-access-abuse', 'sha256')
      and consumed_at is null
      and consumed_by is null
  $$,
  $$ values (1::bigint) $$,
  'a rejected anonymous full-access invite remains unconsumed'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"30000000-0000-4000-8000-000000000003","is_anonymous":false}';

select throws_ok(
  $$
    select public.propose_settlement(
      '94000000-0000-4000-8000-000000000004',
      'space',
      'f0000000-0000-4000-8000-000000000001',
      'MYR',
      100,
      current_date,
      array['a0000000-0000-4000-8000-000000000001'::uuid],
      array[100::bigint],
      'view abuse'
    )
  $$,
  'P0001',
  'space_write_denied',
  'a view-only session cannot propose a Space settlement'
);

reset role;
select results_eq(
  $$
    select count(*)::bigint
    from public.settlement_payments
    where client_request_id = '94000000-0000-4000-8000-000000000004'
  $$,
  $$ values (0::bigint) $$,
  'a rejected view-only proposal creates no settlement'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.financial_events
    where event_type = 'settlement.proposed'
      and safe_diff ->> 'amount_minor' = '100'
  $$,
  $$ values (0::bigint) $$,
  'a rejected view-only proposal creates no audit event'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"40000000-0000-4000-8000-000000000004","is_anonymous":false}';

select throws_ok(
  $$ select public.void_expense('91000000-0000-4000-8000-000000000001') $$,
  'P0001',
  'expense_write_denied',
  'an unrelated authenticated session cannot void a guessed expense'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"20000000-0000-4000-8000-000000000002","is_anonymous":false}';

select throws_ok(
  $$
    select public.update_space_member_role(
      'f0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000003',
      'full_access'
    )
  $$,
  'P0001',
  'owner_required',
  'a full-access member cannot mutate another member role'
);
select throws_ok(
  $$
    select public.remove_space_member(
      'f0000000-0000-4000-8000-000000000001',
      'c0000000-0000-4000-8000-000000000003'
    )
  $$,
  'P0001',
  'member_remove_denied',
  'a full-access member cannot remove another member'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"40000000-0000-4000-8000-000000000004","is_anonymous":false}';

select results_eq(
  $$
    select count(*)::bigint
    from public.expenses
    where id = '91000000-0000-4000-8000-000000000001'
  $$,
  $$ values (0::bigint) $$,
  'a guessed personal expense id cannot be read'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.expenses
    where id = '92000000-0000-4000-8000-000000000002'
  $$,
  $$ values (0::bigint) $$,
  'a guessed direct expense id cannot be read'
);

set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001","is_anonymous":false}';

select is(
  public.create_expense(
      '95000000-0000-4000-8000-000000000005',
      'personal',
      null,
      1234,
      'MYR',
      'Idempotent expense',
      'Other',
      current_date,
      array['a0000000-0000-4000-8000-000000000001'::uuid],
      array[1234::bigint],
      array[1234::bigint]
  ),
  public.create_expense(
      '95000000-0000-4000-8000-000000000005',
      'personal',
      null,
      1234,
      'MYR',
      'Idempotent expense',
      'Other',
      current_date,
      array['a0000000-0000-4000-8000-000000000001'::uuid],
      array[1234::bigint],
      array[1234::bigint]
  ),
  'duplicate expense request ids return the same canonical expense'
);

reset role;
select results_eq(
  $$
    select count(*)::bigint
    from public.expenses
    where client_request_id = '95000000-0000-4000-8000-000000000005'
  $$,
  $$ values (1::bigint) $$,
  'a duplicate expense request creates exactly one expense'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.financial_events as event
    join public.expenses as expense on expense.id = event.expense_id
    where expense.client_request_id = '95000000-0000-4000-8000-000000000005'
      and event.event_type = 'expense.created'
  $$,
  $$ values (1::bigint) $$,
  'a duplicate expense request creates exactly one financial event'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"20000000-0000-4000-8000-000000000002","is_anonymous":false}';

select is(
  public.propose_settlement(
      '96000000-0000-4000-8000-000000000006',
      'direct',
      null,
      'MYR',
      250,
      current_date,
      array['a0000000-0000-4000-8000-000000000001'::uuid],
      array[250::bigint],
      'Idempotent settlement'
  ),
  public.propose_settlement(
      '96000000-0000-4000-8000-000000000006',
      'direct',
      null,
      'MYR',
      250,
      current_date,
      array['a0000000-0000-4000-8000-000000000001'::uuid],
      array[250::bigint],
      'Idempotent settlement'
  ),
  'duplicate settlement request ids return the same canonical payment'
);

reset role;
select results_eq(
  $$
    select count(*)::bigint
    from public.settlement_payments
    where client_request_id = '96000000-0000-4000-8000-000000000006'
  $$,
  $$ values (1::bigint) $$,
  'a duplicate settlement request creates exactly one payment'
);
select results_eq(
  $$
    select count(*)::bigint
    from public.financial_events as event
    join public.settlement_payments as payment
      on payment.id = event.settlement_payment_id
    where payment.client_request_id = '96000000-0000-4000-8000-000000000006'
      and event.event_type = 'settlement.proposed'
  $$,
  $$ values (1::bigint) $$,
  'a duplicate settlement request creates exactly one financial event'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"10000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok(
  $$
    do $block$
    begin
      perform public.create_expense(
        '97000000-0000-4000-8000-000000000007',
        'personal',
        null,
        111,
        'MYR',
        'MYR separation fixture',
        'Other',
        current_date,
        array['a0000000-0000-4000-8000-000000000001'::uuid],
        array[111::bigint],
        array[111::bigint]
      );
      perform public.create_expense(
        '98000000-0000-4000-8000-000000000008',
        'personal',
        null,
        222,
        'USD',
        'USD separation fixture',
        'Other',
        current_date,
        array['a0000000-0000-4000-8000-000000000001'::uuid],
        array[222::bigint],
        array[222::bigint]
      );
    end
    $block$
  $$,
  'multi-currency fixtures can be created through the authenticated expense RPC'
);

select results_eq(
  $$
    select expense.currency, sum(expense.total_minor)::bigint
    from public.expenses as expense
    where expense.client_request_id in (
      '97000000-0000-4000-8000-000000000007',
      '98000000-0000-4000-8000-000000000008'
    )
    group by expense.currency
    order by expense.currency
  $$,
  $$ values ('MYR'::text, 111::bigint), ('USD'::text, 222::bigint) $$,
  'multi-currency amounts remain separated by ISO currency'
);

select ok(
  not pg_catalog.has_function_privilege(
    'anon',
    'public.create_expense(uuid,text,uuid,bigint,text,text,text,date,uuid[],bigint[],bigint[])',
    'EXECUTE'
  ),
  'unauthenticated callers cannot execute expense commands'
);

select ok(
  pg_catalog.has_function_privilege(
    'anon',
    'public.preview_space_invite(text)',
    'EXECUTE'
  ),
  'unauthenticated callers can preview a tokenized Space invite'
);

select ok(
  not pg_catalog.has_function_privilege(
    'authenticated',
    'public.handle_tabby_tally_user()',
    'EXECUTE'
  ),
  'browser roles cannot invoke the Auth provisioning trigger directly'
);

select ok(
  coalesce(
    not pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure(
        'public.delete_group_and_memberships(text,text)'
      ),
      'EXECUTE'
    ),
    true
  ),
  'browser roles cannot invoke the retired legacy group mutator'
);

select ok(
  coalesce(
    not pg_catalog.has_function_privilege(
      'authenticated',
      pg_catalog.to_regprocedure('public.rls_auto_enable()'),
      'EXECUTE'
    ),
    true
  ),
  'browser roles cannot invoke the provider RLS event trigger function'
);

reset role;
select * from finish();
rollback;
