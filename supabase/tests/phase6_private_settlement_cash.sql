begin;

create extension if not exists pgtap with schema extensions;
select plan(64);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000','6a000000-0000-4000-8000-000000000001',
   'authenticated','authenticated','cash-owner@example.test','',now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Owner"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','6b000000-0000-4000-8000-000000000002',
   'authenticated','authenticated','cash-lan@example.test','',now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Lan"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','6c000000-0000-4000-8000-000000000003',
   'authenticated','authenticated','cash-stranger@example.test','',now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Stranger"}',now(),now());

update public.participants
set id = case auth_user_id
  when '6a000000-0000-4000-8000-000000000001' then 'aa000000-0000-4000-8000-000000000001'::uuid
  when '6b000000-0000-4000-8000-000000000002' then 'bb000000-0000-4000-8000-000000000002'::uuid
  when '6c000000-0000-4000-8000-000000000003' then 'cc000000-0000-4000-8000-000000000003'::uuid
end
where auth_user_id in (
  '6a000000-0000-4000-8000-000000000001',
  '6b000000-0000-4000-8000-000000000002',
  '6c000000-0000-4000-8000-000000000003'
);

insert into public.friendships(
  participant_low_id, participant_high_id, requested_by, status, accepted_at
) values (
  'aa000000-0000-4000-8000-000000000001',
  'bb000000-0000-4000-8000-000000000002',
  'aa000000-0000-4000-8000-000000000001','accepted',now()
);

select results_eq(
  $$ select count(*)::bigint from pg_catalog.pg_class where oid in (
    'public.settlement_payment_requests'::regclass,
    'public.settlement_attribution_intents'::regclass,
    'public.personal_settlement_cash_legs'::regclass
  ) and relrowsecurity $$,
  $$ values (3::bigint) $$,
  'RLS is enabled on all new settlement tables'
);

select is(pg_catalog.has_table_privilege(
  'authenticated','public.settlement_payment_requests','SELECT'
),true,'payment requests are selectable only through participant RLS');

select is(pg_catalog.has_table_privilege(
  'authenticated','public.settlement_attribution_intents','SELECT'
),true,'selected-bill metadata follows settlement visibility');

select is(pg_catalog.has_table_privilege(
  'authenticated','public.personal_settlement_cash_legs','SELECT'
),true,'owners can select their private cash legs through RLS');

select is((
  pg_catalog.has_table_privilege('authenticated','public.settlement_payment_requests','INSERT,UPDATE,DELETE')
  or pg_catalog.has_table_privilege('authenticated','public.settlement_attribution_intents','INSERT,UPDATE,DELETE')
  or pg_catalog.has_table_privilege('authenticated','public.personal_settlement_cash_legs','INSERT,UPDATE,DELETE')
),false,'authenticated clients cannot mutate the new tables directly');

select is(pg_catalog.has_function_privilege(
  'authenticated',
  'public.propose_settlement(uuid,text,uuid,text,bigint,date,uuid[],bigint[],text,text,bigint,uuid[],bigint[],uuid)',
  'EXECUTE'
),true,'authenticated debtors can invoke enhanced settlement proposal');

select is(pg_catalog.has_function_privilege(
  'authenticated',
  'public.authorize_personal_settlement_cash_leg(uuid,uuid,text,uuid,bigint)',
  'EXECUTE'
),true,'participants can authorize only their own cash leg');

select is(pg_catalog.has_function_privilege(
  'authenticated','private.direct_signed_outstanding(uuid,uuid,text)','EXECUTE'
),false,'clients cannot call the internal balance authority directly');

select is(pg_catalog.has_function_privilege(
  'anon','public.authorize_personal_settlement_cash_leg(uuid,uuid,text,uuid,bigint)','EXECUTE'
),false,'anonymous clients cannot bind settlement accounts');

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6a000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok($$
  select public.create_personal_account(
    '86000000-0000-4000-8000-000000000001','Owner SGD','bank','SGD',100000,'2026-01-01',true
  )
$$,'debtor can create a private SGD wallet');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6b000000-0000-4000-8000-000000000002","is_anonymous":false}';

select lives_ok($$
  select public.create_personal_account(
    '86000000-0000-4000-8000-000000000002','Lan SGD','bank','SGD',100000,'2026-01-01',true
  )
$$,'creditor can create a private SGD wallet');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6a000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok($$
  select public.create_expense(
    '86000000-0000-4000-8000-000000000003','direct',null,10000,'SGD',
    'Shared dinner','Food','2026-09-21',
    array['aa000000-0000-4000-8000-000000000001'::uuid,
          'bb000000-0000-4000-8000-000000000002'::uuid],
    array[0::bigint,10000::bigint],array[5000::bigint,5000::bigint]
  )
$$,'a Direct bill establishes owner owing Lan SGD 50');

select results_eq($$
  select (public.get_direct_outstanding(
    'bb000000-0000-4000-8000-000000000002','SGD'
  )->>'signed_outstanding_minor')::bigint
$$,$$ values (5000::bigint) $$,
'server balance reports the exact signed Direct debt');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6b000000-0000-4000-8000-000000000002","is_anonymous":false}';

select lives_ok($$
  select public.create_settlement_payment_request(
    '86000000-0000-4000-8000-000000000004',
    'aa000000-0000-4000-8000-000000000001','direct',null,'SGD',5000,
    'Dinner repayment',null
  )
$$,'Lan can request repayment without selecting the owner wallet');

select results_eq($$
  select count(*)::bigint from public.settlement_payments where currency='SGD'
$$,$$ values (0::bigint) $$,
'a repayment request has no financial effect');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6c000000-0000-4000-8000-000000000003","is_anonymous":false}';

select results_eq($$
  select count(*)::bigint from public.settlement_payment_requests
$$,$$ values (0::bigint) $$,
'an unrelated participant cannot see the request');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6a000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok($$
  select public.propose_settlement(
    '86000000-0000-4000-8000-000000000005','direct',null,'SGD',5000,'2026-09-22',
    array['bb000000-0000-4000-8000-000000000002'::uuid],array[5000::bigint],
    'Pay dinner',null,5000,
    array[(select id from public.expenses where description='Shared dinner')],
    array[5000::bigint],
    (select id from public.settlement_payment_requests
     where client_request_id='86000000-0000-4000-8000-000000000004')
  )
$$,'debtor can convert the request into a tracked payment');

select results_eq($$
  select status from public.settlement_payment_requests
  where client_request_id='86000000-0000-4000-8000-000000000004'
$$,$$ values ('converted'::text) $$,
'the reminder is marked converted');

select results_eq($$
  select cash_tracking_required,expected_outstanding_minor,overpay_disposition
  from public.settlement_payments
  where client_request_id='86000000-0000-4000-8000-000000000005'
$$,$$ values (true,5000::bigint,null::text) $$,
'shared payment stores intent metadata but no account ids');

select results_eq($$
  select amount_minor from public.settlement_attribution_intents
  where settlement_payment_id=(select id from public.settlement_payments
    where client_request_id='86000000-0000-4000-8000-000000000005')
$$,$$ values (5000::bigint) $$,
'selected-bill attribution is immutable shared metadata');

select lives_ok($$
  select public.propose_settlement(
    '86000000-0000-4000-8000-000000000005','direct',null,'SGD',5000,'2026-09-22',
    array['bb000000-0000-4000-8000-000000000002'::uuid],array[5000::bigint],
    'Pay dinner',null,5000,
    array[(select id from public.expenses where description='Shared dinner')],
    array[5000::bigint],
    (select id from public.settlement_payment_requests
     where client_request_id='86000000-0000-4000-8000-000000000004')
  )
$$,'identical enhanced proposal retry is idempotent after request conversion');

select results_eq($$
  select count(*)::bigint from public.settlement_attribution_intents
  where settlement_payment_id=(select id from public.settlement_payments
    where client_request_id='86000000-0000-4000-8000-000000000005')
$$,$$ values (1::bigint) $$,
'proposal retry does not duplicate selected bills');

select throws_ok($$
  select public.respond_to_settlement(
    (select id from public.settlement_allocations where settlement_payment_id=(
      select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000005')),
    'accepted',1
  )
$$,'P0001','allocation_write_denied',
'debtor cannot accept their own allocation');

select lives_ok($$
  select public.authorize_personal_settlement_cash_leg(
    '86000000-0000-4000-8000-000000000006',
    (select id from public.settlement_allocations where settlement_payment_id=(
      select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000005')),
    'payer',(select id from public.personal_accounts where name='Owner SGD'),5000
  )
$$,'debtor chooses only their own paying account');

select results_eq($$
  select count(*)::bigint from public.personal_settlement_cash_legs
$$,$$ values (1::bigint) $$,
'debtor sees exactly one private payer leg');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6b000000-0000-4000-8000-000000000002","is_anonymous":false}';

select results_eq($$
  select count(*)::bigint from public.personal_settlement_cash_legs
$$,$$ values (0::bigint) $$,
'Lan cannot read the debtor account binding');

select throws_ok($$
  select public.respond_to_settlement(
    (select id from public.settlement_allocations where settlement_payment_id=(
      select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000005')),
    'accepted',1
  )
$$,'P0001','settlement_cash_authorization_required',
'accept waits for Lan to choose a receiving account');

select lives_ok($$
  select public.authorize_personal_settlement_cash_leg(
    '86000000-0000-4000-8000-000000000007',
    (select id from public.settlement_allocations where settlement_payment_id=(
      select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000005')),
    'receiver',(select id from public.personal_accounts where name='Lan SGD'),null
  )
$$,'Lan chooses only their own receiving account');

select results_eq($$
  select count(*)::bigint from public.personal_settlement_cash_legs
$$,$$ values (1::bigint) $$,
'Lan sees only the private receiver leg');

select lives_ok($$
  select public.respond_to_settlement(
    (select id from public.settlement_allocations where settlement_payment_id=(
      select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000005')),
    'accepted',1
  )
$$,'Lan can accept after both owners independently authorize cash');

select results_eq($$
  select state from public.settlement_allocations where settlement_payment_id=(
    select id from public.settlement_payments
    where client_request_id='86000000-0000-4000-8000-000000000005')
$$,$$ values ('accepted'::text) $$,
'the shared allocation becomes accepted');

reset role;
select results_eq($$
  select count(*)::bigint from public.personal_settlement_cash_legs
  where settlement_payment_id=(select id from public.settlement_payments
    where client_request_id='86000000-0000-4000-8000-000000000005')
    and status='posted'
$$,$$ values (2::bigint) $$,
'only this accepted allocation posts two owner-private legs');

select results_eq($$
  select entry.amount_minor
  from public.personal_settlement_cash_legs leg
  join public.personal_account_entries entry
    on entry.transaction_id=leg.posted_transaction_id
  where leg.settlement_payment_id=(select id from public.settlement_payments
    where client_request_id='86000000-0000-4000-8000-000000000005')
    and leg.role='payer'
$$,$$ values (-5000::bigint) $$,
'payer wallet decreases by the accepted allocation');

select results_eq($$
  select entry.amount_minor
  from public.personal_settlement_cash_legs leg
  join public.personal_account_entries entry
    on entry.transaction_id=leg.posted_transaction_id
  where leg.settlement_payment_id=(select id from public.settlement_payments
    where client_request_id='86000000-0000-4000-8000-000000000005')
    and leg.role='receiver'
$$,$$ values (5000::bigint) $$,
'receiver wallet increases by the accepted allocation');

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6a000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq($$
  select (public.get_direct_outstanding(
    'bb000000-0000-4000-8000-000000000002','SGD'
  )->>'signed_outstanding_minor')::bigint
$$,$$ values (0::bigint) $$,
'full accepted T clears the Direct debt');

select is((
  select pg_catalog.bool_and(safe_diff::text not like '%account_id%')
  from public.financial_events
  where settlement_payment_id=(select id from public.settlement_payments
    where client_request_id='86000000-0000-4000-8000-000000000005')
),true,'shared financial events do not leak either account id');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6b000000-0000-4000-8000-000000000002","is_anonymous":false}';

select lives_ok($$
  select public.reverse_settlement_allocation(
    '86000000-0000-4000-8000-000000000008',
    (select id from public.settlement_allocations where settlement_payment_id=(
      select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000005')),
    2,'Correction'
  )
$$,'allocation reversal also creates compensating private journals');

reset role;
select results_eq($$
  select count(*)::bigint from public.personal_settlement_cash_legs
  where settlement_payment_id=(select id from public.settlement_payments
    where client_request_id='86000000-0000-4000-8000-000000000005')
    and status='reversed'
$$,$$ values (2::bigint) $$,
'both private legs reverse atomically');

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6a000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq($$
  select (public.get_direct_outstanding(
    'bb000000-0000-4000-8000-000000000002','SGD'
  )->>'signed_outstanding_minor')::bigint
$$,$$ values (5000::bigint) $$,
'reversal restores the shared debt exactly once');

select lives_ok($$
  select public.create_personal_account(
    '86000000-0000-4000-8000-000000000009','Owner USD','bank','USD',100000,'2026-01-01',false
  )
$$,'owner can create a USD cash account');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6b000000-0000-4000-8000-000000000002","is_anonymous":false}';

select lives_ok($$
  select public.create_personal_account(
    '86000000-0000-4000-8000-000000000010','Lan USD','bank','USD',100000,'2026-01-01',false
  )
$$,'Lan can create a USD receiving account');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6a000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok($$
  select public.create_expense(
    '86000000-0000-4000-8000-000000000011','direct',null,17900,'USD',
    'Gift example','Food','2026-09-21',
    array['aa000000-0000-4000-8000-000000000001'::uuid,
          'bb000000-0000-4000-8000-000000000002'::uuid],
    array[0::bigint,17900::bigint],array[8950::bigint,8950::bigint]
  )
$$,'gift example establishes USD 89.50 debt');

select lives_ok($$
  select public.propose_settlement(
    '86000000-0000-4000-8000-000000000012','direct',null,'USD',8950,'2026-09-22',
    array['bb000000-0000-4000-8000-000000000002'::uuid],array[8950::bigint],
    'Round up','gift',8950,null,null,null
  )
$$,'gift proposal caps shared T at current debt');

select lives_ok($$
  select public.authorize_personal_settlement_cash_leg(
    '86000000-0000-4000-8000-000000000013',
    (select id from public.settlement_allocations where settlement_payment_id=(
      select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000012')),
    'payer',(select id from public.personal_accounts where name='Owner USD'),9000
  )
$$,'payer records the actual rounded USD 90 cash');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6b000000-0000-4000-8000-000000000002","is_anonymous":false}';

select lives_ok($$
  select public.authorize_personal_settlement_cash_leg(
    '86000000-0000-4000-8000-000000000014',
    (select id from public.settlement_allocations where settlement_payment_id=(
      select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000012')),
    'receiver',(select id from public.personal_accounts where name='Lan USD'),null
  )
$$,'receiver derives the agreed actual cash without seeing payer account');

select lives_ok($$
  select public.respond_to_settlement(
    (select id from public.settlement_allocations where settlement_payment_id=(
      select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000012')),
    'accepted',1
  )
$$,'gift settlement can be accepted');

reset role;
select results_eq($$
  select amount_minor from public.settlement_payments
  where client_request_id='86000000-0000-4000-8000-000000000012'
$$,$$ values (8950::bigint) $$,
'gift leaves shared T at USD 89.50');

select results_eq($$
  select array_agg(distinct gift_extra_minor order by gift_extra_minor)
  from public.personal_settlement_cash_legs
  where settlement_payment_id=(select id from public.settlement_payments
    where client_request_id='86000000-0000-4000-8000-000000000012')
$$,$$ values (array[50::bigint]) $$,
'USD 0.50 is classified as private gift cash on both sides');

select results_eq($$
  select count(*)::bigint from public.personal_account_transactions
  where settlement_allocation_id=(select id from public.settlement_allocations
    where settlement_payment_id=(select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000012'))
    and kind in ('gift_out','gift_in')
$$,$$ values (2::bigint) $$,
'gift extra uses dedicated gift journals rather than income or expense');

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6a000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq($$
  select (public.get_direct_outstanding(
    'bb000000-0000-4000-8000-000000000002','USD'
  )->>'signed_outstanding_minor')::bigint
$$,$$ values (0::bigint) $$,
'gift extra does not change F');

select lives_ok($$
  select public.create_personal_account(
    '86000000-0000-4000-8000-000000000015','Owner EUR','bank','EUR',100000,'2026-01-01',false
  )
$$,'owner can create a EUR account');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6b000000-0000-4000-8000-000000000002","is_anonymous":false}';

select lives_ok($$
  select public.create_personal_account(
    '86000000-0000-4000-8000-000000000016','Lan EUR','bank','EUR',100000,'2026-01-01',false
  )
$$,'Lan can create a EUR account');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6a000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok($$
  select public.create_expense(
    '86000000-0000-4000-8000-000000000017','direct',null,17900,'EUR',
    'Carry example','Food','2026-09-21',
    array['aa000000-0000-4000-8000-000000000001'::uuid,
          'bb000000-0000-4000-8000-000000000002'::uuid],
    array[0::bigint,17900::bigint],array[8950::bigint,8950::bigint]
  )
$$,'carry example establishes EUR 89.50 debt');

select lives_ok($$
  select public.propose_settlement(
    '86000000-0000-4000-8000-000000000018','direct',null,'EUR',9000,'2026-09-22',
    array['bb000000-0000-4000-8000-000000000002'::uuid],array[9000::bigint],
    'Carry remainder','carry',8950,null,null,null
  )
$$,'carry proposal places all EUR 90 into shared T');

select lives_ok($$
  select public.authorize_personal_settlement_cash_leg(
    '86000000-0000-4000-8000-000000000019',
    (select id from public.settlement_allocations where settlement_payment_id=(
      select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000018')),
    'payer',(select id from public.personal_accounts where name='Owner EUR'),9000
  )
$$,'payer authorizes EUR 90 carry cash');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6b000000-0000-4000-8000-000000000002","is_anonymous":false}';

select lives_ok($$
  select public.authorize_personal_settlement_cash_leg(
    '86000000-0000-4000-8000-000000000020',
    (select id from public.settlement_allocations where settlement_payment_id=(
      select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000018')),
    'receiver',(select id from public.personal_accounts where name='Lan EUR'),null
  )
$$,'receiver authorizes EUR 90 carry receipt');

select lives_ok($$
  select public.respond_to_settlement(
    (select id from public.settlement_allocations where settlement_payment_id=(
      select id from public.settlement_payments
      where client_request_id='86000000-0000-4000-8000-000000000018')),
    'accepted',1
  )
$$,'carry settlement can be accepted');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6a000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq($$
  select (public.get_direct_outstanding(
    'bb000000-0000-4000-8000-000000000002','EUR'
  )->>'signed_outstanding_minor')::bigint
$$,$$ values (-50::bigint) $$,
'carry flips the EUR 0.50 residual to the other direction');

select lives_ok($$
  select public.create_expense(
    '86000000-0000-4000-8000-000000000021','direct',null,20000,'MYR',
    'Partial example','Food','2026-09-21',
    array['aa000000-0000-4000-8000-000000000001'::uuid,
          'bb000000-0000-4000-8000-000000000002'::uuid],
    array[0::bigint,20000::bigint],array[10000::bigint,10000::bigint]
  )
$$,'partial example establishes MYR 100 debt');

select lives_ok($$
  select public.propose_settlement(
    '86000000-0000-4000-8000-000000000022','direct',null,'MYR',4000,'2026-09-22',
    array['bb000000-0000-4000-8000-000000000002'::uuid],array[4000::bigint],
    'Partial',null,10000,null,null,null
  )
$$,'partial proposal records only MYR 40 shared T');

select throws_ok($$
  select public.propose_settlement(
    '86000000-0000-4000-8000-000000000023','direct',null,'MYR',4000,'2026-09-22',
    array['bb000000-0000-4000-8000-000000000002'::uuid],array[4000::bigint],
    'Stale',null,9999,null,null,null
  )
$$,'P0001','balance_changed',
'stale outstanding snapshot is rejected before another payment');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6b000000-0000-4000-8000-000000000002","is_anonymous":false}';

select throws_ok($$
  select public.cancel_settlement_payment_request(
    (select id from public.settlement_payment_requests
     where client_request_id='86000000-0000-4000-8000-000000000004'),2
  )
$$,'P0001','settlement_payment_request_state_conflict',
'converted requests cannot be silently cancelled');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"6c000000-0000-4000-8000-000000000003","is_anonymous":false}';

select results_eq($$
  select count(*)::bigint from public.personal_settlement_cash_legs
$$,$$ values (0::bigint) $$,
'unrelated account cannot read any private settlement cash leg');

select results_eq($$
  select count(*)::bigint from public.settlement_payment_requests
$$,$$ values (0::bigint) $$,
'unrelated account cannot read payment requests');

select * from finish();
rollback;
