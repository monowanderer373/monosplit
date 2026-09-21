begin;

create extension if not exists pgtap with schema extensions;
select plan(48);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '68000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'installment-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Owner"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '69000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'installment-stranger@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Stranger"}',
    now(), now()
  );

update public.participants
set id = case auth_user_id
  when '68000000-0000-4000-8000-000000000001'
    then 'a6800000-0000-4000-8000-000000000001'::uuid
  when '69000000-0000-4000-8000-000000000002'
    then 'b6900000-0000-4000-8000-000000000002'::uuid
end
where auth_user_id in (
  '68000000-0000-4000-8000-000000000001',
  '69000000-0000-4000-8000-000000000002'
);

select results_eq(
  $$
    select count(*)::bigint from pg_catalog.pg_class
    where oid in (
      'public.personal_installment_plans'::regclass,
      'public.personal_installments'::regclass
    ) and relrowsecurity
  $$,
  $$ values (2::bigint) $$,
  'RLS is enabled on both installment tables'
);

select is(
  pg_catalog.has_table_privilege(
    'authenticated', 'public.personal_installment_plans', 'SELECT'
  ), true,
  'authenticated owners can select their plans through RLS'
);

select is(
  (
    pg_catalog.has_table_privilege(
      'authenticated', 'public.personal_installment_plans', 'INSERT,UPDATE,DELETE'
    ) or pg_catalog.has_table_privilege(
      'authenticated', 'public.personal_installments', 'INSERT,UPDATE,DELETE'
    )
  ), false,
  'authenticated clients cannot mutate installment tables directly'
);

select is(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_installment_plan_for_expense(uuid,uuid,uuid,text,integer,date,text,time without time zone)',
    'EXECUTE'
  ), true,
  'authenticated owners can create guarded installment plans'
);

select is(
  pg_catalog.has_function_privilege(
    'authenticated',
    'private.catch_up_personal_installments_for(uuid,date)', 'EXECUTE'
  ), false,
  'authenticated clients cannot override the installment catch-up clock'
);

select is(
  pg_catalog.has_function_privilege(
    'anon', 'public.catch_up_personal_installments()', 'EXECUTE'
  ), false,
  'anonymous clients cannot auto-post installment repayments'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"68000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok(
  $$
    select public.create_personal_account(
      '71000000-0000-4000-8000-000000000041',
      'CIMB', 'bank', 'MYR', 100000, '2026-01-01', true
    )
  $$,
  'the owner can create the repayment asset account'
);

select lives_ok(
  $$
    select public.create_personal_account(
      '71000000-0000-4000-8000-000000000042',
      'CIMB Credit', 'credit_card', 'MYR', null, null, false
    )
  $$,
  'the owner can create the liability account'
);

select lives_ok(
  $$
    select public.create_installment_purchase(
      '72000000-0000-4000-8000-000000000041',
      'personal', null, 600000, 'VND', 'Hotel', 'Travel', '2026-09-21',
      array['a6800000-0000-4000-8000-000000000001'::uuid],
      array[600000::bigint], array[600000::bigint],
      '73000000-0000-4000-8000-000000000041',
      (select id from public.personal_accounts where name = 'CIMB Credit'),
      11360,
      '74000000-0000-4000-8000-000000000041',
      (select id from public.personal_accounts where name = 'CIMB'),
      'n_installments', 4, '2026-10-31', 'Asia/Kuala_Lumpur', '00:00'
    )
  $$,
  'purchase expense, liability principal, and schedule can be created atomically'
);

select results_eq(
  $$
    select status from public.personal_installment_plans
    where client_request_id = '74000000-0000-4000-8000-000000000041'
  $$,
  $$ values ('active'::text) $$,
  'known principal activates the plan immediately'
);

select results_eq(
  $$
    select principal_minor, currency from public.personal_installment_plans
    where client_request_id = '74000000-0000-4000-8000-000000000041'
  $$,
  $$ values (11360::bigint, 'MYR'::text) $$,
  'principal and schedule currency come from the liability account, not the expense'
);

select results_eq(
  $$
    select count(*)::bigint, sum(principal_minor)::bigint
    from public.personal_installments
    where plan_id = (
      select id from public.personal_installment_plans
      where client_request_id = '74000000-0000-4000-8000-000000000041'
    )
  $$,
  $$ values (4::bigint, 11360::bigint) $$,
  'generated installments sum exactly to principal'
);

select results_eq(
  $$
    select due_on from public.personal_installments
    where plan_id = (
      select id from public.personal_installment_plans
      where client_request_id = '74000000-0000-4000-8000-000000000041'
    ) order by sequence
  $$,
  $$
    values
      ('2026-10-31'::date), ('2026-11-30'::date),
      ('2026-12-31'::date), ('2027-01-31'::date)
  $$,
  'month-end schedule clamps short months and recovers the original anchor'
);

select lives_ok(
  $$
    select public.create_installment_purchase(
      '72000000-0000-4000-8000-000000000041',
      'personal', null, 600000, 'VND', 'Hotel', 'Travel', '2026-09-21',
      array['a6800000-0000-4000-8000-000000000001'::uuid],
      array[600000::bigint], array[600000::bigint],
      '73000000-0000-4000-8000-000000000041',
      (select id from public.personal_accounts where name = 'CIMB Credit'),
      11360,
      '74000000-0000-4000-8000-000000000041',
      (select id from public.personal_accounts where name = 'CIMB'),
      'n_installments', 4, '2026-10-31', 'Asia/Kuala_Lumpur', '00:00'
    )
  $$,
  'an identical installment purchase retry is idempotent'
);

select results_eq(
  $$
    select count(*)::bigint from public.personal_installment_plans
    where client_request_id = '74000000-0000-4000-8000-000000000041'
  $$,
  $$ values (1::bigint) $$,
  'idempotent retries do not create duplicate plans'
);

select throws_ok(
  $$
    select public.create_installment_plan_for_expense(
      '74000000-0000-4000-8000-000000000041',
      (select purchase_expense_id from public.personal_installment_plans
       where client_request_id = '74000000-0000-4000-8000-000000000041'),
      (select id from public.personal_accounts where name = 'CIMB'),
      'n_installments', 3, '2026-10-31', 'Asia/Kuala_Lumpur', '00:00'
    )
  $$,
  'P0001', 'idempotency_conflict',
  'a plan request ID cannot be reused with changed terms'
);

select throws_ok(
  $$
    select public.create_installment_plan_for_expense(
      '74000000-0000-4000-8000-000000000042',
      (select purchase_expense_id from public.personal_installment_plans
       where client_request_id = '74000000-0000-4000-8000-000000000041'),
      (select id from public.personal_accounts where name = 'CIMB'),
      'n_installments', 2, '2026-10-31', 'Asia/Kuala_Lumpur', '00:00'
    )
  $$,
  'P0001', 'invalid_installment_plan',
  'V1 enforces one payment or three to twenty-four installments'
);

reset role;
select lives_ok(
  $$
    select private.catch_up_personal_installments_for(
      'a6800000-0000-4000-8000-000000000001', '2026-10-31'
    )
  $$,
  'the internal test clock can post the first due repayment'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"68000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq(
  $$
    select status from public.personal_installments
    where plan_id = (
      select id from public.personal_installment_plans
      where client_request_id = '74000000-0000-4000-8000-000000000041'
    ) and sequence = 1
  $$,
  $$ values ('posted'::text) $$,
  'the first installment is posted'
);

select results_eq(
  $$
    select journal.kind
    from public.personal_installments as installment
    join public.personal_account_transactions as journal
      on journal.id = installment.posted_transaction_id
    where installment.plan_id = (
      select id from public.personal_installment_plans
      where client_request_id = '74000000-0000-4000-8000-000000000041'
    ) and installment.sequence = 1
  $$,
  $$ values ('liability_repayment'::text) $$,
  'installment payment is a liability repayment, not an expense'
);

select results_eq(
  $$
    select array_agg(entry.amount_minor order by account.account_class, entry.amount_minor)
    from public.personal_installments as installment
    join public.personal_account_entries as entry
      on entry.transaction_id = installment.posted_transaction_id
    join public.personal_accounts as account on account.id = entry.account_id
    where installment.plan_id = (
      select id from public.personal_installment_plans
      where client_request_id = '74000000-0000-4000-8000-000000000041'
    ) and installment.sequence = 1
  $$,
  $$ values (array[-2840::bigint, -2840::bigint]) $$,
  'repayment decreases both the asset and liability by explicit account amounts'
);

select results_eq(
  $$ select count(*)::bigint from public.expenses where description = 'Hotel' $$,
  $$ values (1::bigint) $$,
  'repayment does not create a second Canonical Expense'
);

select lives_ok(
  $$
    select public.reverse_installment(
      '75000000-0000-4000-8000-000000000041',
      (select id from public.personal_installments
       where plan_id = (select id from public.personal_installment_plans
         where client_request_id = '74000000-0000-4000-8000-000000000041')
         and sequence = 1),
      (select version from public.personal_installments
       where plan_id = (select id from public.personal_installment_plans
         where client_request_id = '74000000-0000-4000-8000-000000000041')
         and sequence = 1),
      '2026-11-01', 'Bank correction'
    )
  $$,
  'a posted repayment can be reversed with a compensating journal'
);

select results_eq(
  $$
    select status from public.personal_installments
    where plan_id = (select id from public.personal_installment_plans
      where client_request_id = '74000000-0000-4000-8000-000000000041')
      and sequence = 1
  $$,
  $$ values ('reversed'::text) $$,
  'reversal state follows the journal reversal'
);

select results_eq(
  $$
    select status from public.personal_installment_plans
    where client_request_id = '74000000-0000-4000-8000-000000000041'
  $$,
  $$ values ('active'::text) $$,
  'reversing a repayment reopens the plan'
);

select lives_ok(
  $$
    select public.create_expense_with_funding(
      '72000000-0000-4000-8000-000000000043',
      'personal', null, 300000, 'VND', 'Foreign phone', 'Electronics', '2026-09-21',
      array['a6800000-0000-4000-8000-000000000001'::uuid],
      array[300000::bigint], array[300000::bigint],
      '73000000-0000-4000-8000-000000000043',
      (select id from public.personal_accounts where name = 'CIMB Credit'), null
    )
  $$,
  'a cross-currency liability purchase can remain pending'
);

select lives_ok(
  $$
    select public.create_installment_plan_for_expense(
      '74000000-0000-4000-8000-000000000043',
      (select id from public.expenses where description = 'Foreign phone'),
      (select id from public.personal_accounts where name = 'CIMB'),
      'n_installments', 3, '2026-10-15', 'Asia/Kuala_Lumpur', '00:00'
    )
  $$,
  'a plan can wait for unknown billed principal'
);

select results_eq(
  $$
    select status from public.personal_installment_plans
    where client_request_id = '74000000-0000-4000-8000-000000000043'
  $$,
  $$ values ('pending_principal'::text) $$,
  'unknown billed principal is explicit'
);

select results_eq(
  $$
    select count(*)::bigint from public.personal_installments
    where plan_id = (select id from public.personal_installment_plans
      where client_request_id = '74000000-0000-4000-8000-000000000043')
  $$,
  $$ values (0::bigint) $$,
  'no schedule is generated before actual principal is known'
);

select lives_ok(
  $$
    select public.complete_pending_funding(
      '75000000-0000-4000-8000-000000000043',
      (select funding_intent_id from public.personal_installment_plans
       where client_request_id = '74000000-0000-4000-8000-000000000043'),
      (select id from public.personal_accounts where name = 'CIMB Credit'),
      5680
    )
  $$,
  'actual billed principal can be completed later'
);

select results_eq(
  $$
    select status from public.personal_installment_plans
    where client_request_id = '74000000-0000-4000-8000-000000000043'
  $$,
  $$ values ('active'::text) $$,
  'funding completion activates the pending plan'
);

select results_eq(
  $$
    select count(*)::bigint from public.personal_installments
    where plan_id = (select id from public.personal_installment_plans
      where client_request_id = '74000000-0000-4000-8000-000000000043')
  $$,
  $$ values (3::bigint) $$,
  'completion generates the schedule exactly once'
);

select results_eq(
  $$
    select sum(principal_minor)::bigint from public.personal_installments
    where plan_id = (select id from public.personal_installment_plans
      where client_request_id = '74000000-0000-4000-8000-000000000043')
  $$,
  $$ values (5680::bigint) $$,
  'new rows use the actual MYR principal'
);

select lives_ok(
  $$
    select public.create_personal_account(
      '71000000-0000-4000-8000-000000000044',
      'VND Cash', 'cash', 'VND', null, null, false
    )
  $$,
  'the owner can create a different-currency repayment account'
);

select lives_ok(
  $$
    select public.edit_future_installment(
      (select id from public.personal_installments
       where plan_id = (select id from public.personal_installment_plans
         where client_request_id = '74000000-0000-4000-8000-000000000043')
         and sequence = 1),
      (select version from public.personal_installments
       where plan_id = (select id from public.personal_installment_plans
         where client_request_id = '74000000-0000-4000-8000-000000000043')
         and sequence = 1),
      '2026-10-15',
      (select id from public.personal_accounts where name = 'VND Cash'), null
    )
  $$,
  'a future installment can change its due date or repayment account'
);

reset role;
select lives_ok(
  $$
    select private.catch_up_personal_installments_for(
      'a6800000-0000-4000-8000-000000000001', '2026-10-15'
    )
  $$,
  'cross-currency auto-post stops safely when actual cash is unknown'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"68000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq(
  $$
    select status, error_code from public.personal_installments
    where plan_id = (select id from public.personal_installment_plans
      where client_request_id = '74000000-0000-4000-8000-000000000043')
      and sequence = 1
  $$,
  $$ values ('failed'::text, 'actual_payment_required'::text) $$,
  'missing cross-currency cash is a recoverable explicit failure'
);

select results_eq(
  $$
    select count(*)::bigint from public.personal_account_transactions
    where installment_id = (select id from public.personal_installments
      where plan_id = (select id from public.personal_installment_plans
        where client_request_id = '74000000-0000-4000-8000-000000000043')
        and sequence = 1)
  $$,
  $$ values (0::bigint) $$,
  'failed cross-currency posting leaves no orphan journal'
);

select lives_ok(
  $$
    select public.edit_future_installment(
      (select id from public.personal_installments
       where plan_id = (select id from public.personal_installment_plans
         where client_request_id = '74000000-0000-4000-8000-000000000043')
         and sequence = 1),
      (select version from public.personal_installments
       where plan_id = (select id from public.personal_installment_plans
         where client_request_id = '74000000-0000-4000-8000-000000000043')
         and sequence = 1),
      '2026-10-15',
      (select id from public.personal_accounts where name = 'VND Cash'), 350000
    )
  $$,
  'the failed row can be corrected with actual account-currency cash'
);

select lives_ok(
  $$
    select public.post_installment_repayment(
      (select id from public.personal_installments
       where plan_id = (select id from public.personal_installment_plans
         where client_request_id = '74000000-0000-4000-8000-000000000043')
         and sequence = 1)
    )
  $$,
  'a corrected cross-currency row can be posted'
);

select results_eq(
  $$
    select status from public.personal_installments
    where plan_id = (select id from public.personal_installment_plans
      where client_request_id = '74000000-0000-4000-8000-000000000043')
      and sequence = 1
  $$,
  $$ values ('posted'::text) $$,
  'the corrected repayment reaches posted state'
);

select lives_ok(
  $$
    select public.create_installment_purchase(
      '72000000-0000-4000-8000-000000000045',
      'personal', null, 9000, 'MYR', 'PayLater item', 'Shopping', '2026-09-21',
      array['a6800000-0000-4000-8000-000000000001'::uuid],
      array[9000::bigint], array[9000::bigint],
      '73000000-0000-4000-8000-000000000045',
      (select id from public.personal_accounts where name = 'CIMB Credit'), null,
      '74000000-0000-4000-8000-000000000045',
      (select id from public.personal_accounts where name = 'CIMB'),
      'n_installments', 3, '2026-10-01', 'Asia/Kuala_Lumpur', '00:00'
    )
  $$,
  'a same-currency PayLater plan can be created for early payoff'
);

select lives_ok(
  $$
    select public.pay_off_installment_plan(
      '75000000-0000-4000-8000-000000000045',
      (select id from public.personal_installment_plans
       where client_request_id = '74000000-0000-4000-8000-000000000045'),
      (select version from public.personal_installment_plans
       where client_request_id = '74000000-0000-4000-8000-000000000045'),
      (select id from public.personal_accounts where name = 'CIMB'),
      9000, '2026-09-30'
    )
  $$,
  'the owner can pay off all remaining principal early'
);

select results_eq(
  $$
    select status from public.personal_installment_plans
    where client_request_id = '74000000-0000-4000-8000-000000000045'
  $$,
  $$ values ('paid_off'::text) $$,
  'early payoff closes the plan'
);

select results_eq(
  $$
    select count(*)::bigint from public.personal_installments
    where plan_id = (select id from public.personal_installment_plans
      where client_request_id = '74000000-0000-4000-8000-000000000045')
      and status = 'skipped'
  $$,
  $$ values (2::bigint) $$,
  'later scheduled rows are skipped after payoff'
);

select results_eq(
  $$
    select count(*)::bigint from public.personal_account_transactions
    where installment_id in (
      select id from public.personal_installments
      where plan_id = (select id from public.personal_installment_plans
        where client_request_id = '74000000-0000-4000-8000-000000000045')
    ) and kind = 'liability_repayment'
  $$,
  $$ values (1::bigint) $$,
  'payoff posts remaining principal once'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"69000000-0000-4000-8000-000000000002","is_anonymous":false}';

select results_eq(
  $$ select count(*)::bigint from public.personal_installment_plans $$,
  $$ values (0::bigint) $$,
  'another account cannot read the owner installment plans'
);

select results_eq(
  $$ select count(*)::bigint from public.personal_installments $$,
  $$ values (0::bigint) $$,
  'another account cannot read the owner installment rows'
);

select * from finish();
rollback;
