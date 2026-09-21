begin;

create extension if not exists pgtap with schema extensions;
select plan(54);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '66000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'recurring-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Owner"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '67000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'recurring-stranger@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Stranger"}',
    now(), now()
  );

update public.participants
set id = case auth_user_id
  when '66000000-0000-4000-8000-000000000001'
    then 'a6600000-0000-4000-8000-000000000001'::uuid
  when '67000000-0000-4000-8000-000000000002'
    then 'b6700000-0000-4000-8000-000000000002'::uuid
end
where auth_user_id in (
  '66000000-0000-4000-8000-000000000001',
  '67000000-0000-4000-8000-000000000002'
);

select results_eq(
  $$
    select count(*)::bigint from pg_catalog.pg_class
    where oid in (
      'public.personal_recurring_rules'::regclass,
      'public.personal_recurring_occurrences'::regclass
    ) and relrowsecurity
  $$,
  $$ values (2::bigint) $$,
  'RLS is enabled on both typed recurring tables'
);

select is(
  pg_catalog.has_table_privilege(
    'authenticated', 'public.personal_recurring_rules', 'SELECT'
  ), true,
  'authenticated owners can select their recurring rules through RLS'
);

select is(
  (
    pg_catalog.has_table_privilege(
      'authenticated', 'public.personal_recurring_rules', 'INSERT,UPDATE,DELETE'
    ) or pg_catalog.has_table_privilege(
      'authenticated', 'public.personal_recurring_occurrences', 'INSERT,UPDATE,DELETE'
    )
  ), false,
  'authenticated clients cannot mutate recurring tables directly'
);

select is(
  pg_catalog.has_function_privilege(
    'authenticated', 'public.catch_up_personal_recurring()', 'EXECUTE'
  ), true,
  'authenticated owners can invoke server-time catch-up'
);

select is(
  pg_catalog.has_function_privilege(
    'authenticated',
    'private.catch_up_personal_recurring_for(uuid,date)', 'EXECUTE'
  ), false,
  'authenticated clients cannot supply a catch-up clock override'
);

select is(
  pg_catalog.has_function_privilege(
    'anon', 'public.catch_up_personal_recurring()', 'EXECUTE'
  ), false,
  'anonymous clients cannot auto-post recurring expenses'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"66000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok(
  $$
    select public.create_personal_account(
      '71000000-0000-4000-8000-000000000031',
      'Touch n Go', 'ewallet', 'MYR', 500000, '2026-01-01', true
    )
  $$,
  'the owner can create the funding account'
);

select lives_ok(
  $$
    select public.create_personal_account(
      '71000000-0000-4000-8000-000000000032',
      'Old wallet', 'cash', 'MYR', null, null, false
    )
  $$,
  'the owner can create a second account used for failure recovery'
);

select lives_ok(
  $$
    select public.create_personal_recurring_rule(
      '72000000-0000-4000-8000-000000000031',
      'Rent', 'Monthly rent', 80000, 'MYR', 'Housing',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      'monthly', 31, null, 'Asia/Kuala_Lumpur', '00:00',
      '2026-01-31', null, 'auto_post'
    )
  $$,
  'a typed monthly auto-post rule can be created'
);

select results_eq(
  $$
    select cadence, anchor_day_of_month, anchor_weekday,
           start_on, next_due_on, posting_mode
    from public.personal_recurring_rules where title = 'Rent'
  $$,
  $$
    values (
      'monthly'::text, 31::integer, null::integer,
      '2026-01-31'::date, '2026-01-31'::date, 'auto_post'::text
    )
  $$,
  'monthly and weekly anchors remain structurally separate'
);

select lives_ok(
  $$
    select public.create_personal_recurring_rule(
      '72000000-0000-4000-8000-000000000031',
      'Rent', 'Monthly rent', 80000, 'MYR', 'Housing',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      'monthly', 31, null, 'Asia/Kuala_Lumpur', '00:00',
      '2026-01-31', null, 'auto_post'
    )
  $$,
  'an identical rule creation retry is idempotent'
);

select results_eq(
  $$
    select count(*)::bigint from public.personal_recurring_rules
    where client_request_id = '72000000-0000-4000-8000-000000000031'
  $$,
  $$ values (1::bigint) $$,
  'rule creation retry does not mint a duplicate'
);

select throws_ok(
  $$
    select public.create_personal_recurring_rule(
      '72000000-0000-4000-8000-000000000031',
      'Rent changed', 'Monthly rent', 80000, 'MYR', 'Housing',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      'monthly', 31, null, 'Asia/Kuala_Lumpur', '00:00',
      '2026-01-31', null, 'auto_post'
    )
  $$,
  'P0001', 'idempotency_conflict',
  'rule request IDs cannot be reused for changed payloads'
);

select throws_ok(
  $$
    select public.create_personal_recurring_rule(
      '72000000-0000-4000-8000-000000000032',
      'Bad anchor', null, 100, 'MYR', 'Other',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      'weekly', 12, 1, 'UTC', '00:00', current_date, null, 'auto_post'
    )
  $$,
  'P0001', 'invalid_recurring_cadence',
  'weekly rules reject a simultaneous monthly anchor'
);

reset role;
select lives_ok(
  $$
    select private.catch_up_personal_recurring_for(
      'a6600000-0000-4000-8000-000000000001', '2026-02-28'
    )
  $$,
  'the internal test clock can catch up through February'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"66000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq(
  $$
    select scheduled_for, status from public.personal_recurring_occurrences
    where rule_id = (select id from public.personal_recurring_rules where title = 'Rent')
    order by scheduled_for
  $$,
  $$
    values
      ('2026-01-31'::date, 'posted'::text),
      ('2026-02-28'::date, 'posted'::text)
  $$,
  'month-end catch-up clamps February without losing the day-31 anchor'
);

select results_eq(
  $$ select next_due_on from public.personal_recurring_rules where title = 'Rent' $$,
  $$ values ('2026-03-31'::date) $$,
  'the next monthly date recovers to March 31'
);

select results_eq(
  $$
    select count(*)::bigint from public.expenses
    where client_request_id in (
      select expense_request_id from public.personal_recurring_occurrences
      where rule_id = (select id from public.personal_recurring_rules where title = 'Rent')
    )
  $$,
  $$ values (2::bigint) $$,
  'each posted occurrence creates exactly one Canonical Expense'
);

select results_eq(
  $$
    select count(distinct expense_request_id)::bigint,
           count(distinct funding_request_id)::bigint
    from public.personal_recurring_occurrences
    where rule_id = (select id from public.personal_recurring_rules where title = 'Rent')
  $$,
  $$ values (2::bigint, 2::bigint) $$,
  'deterministic expense and funding request IDs are unique per occurrence'
);

select results_eq(
  $$
    select count(*)::bigint from public.personal_account_entries as entry
    join public.personal_account_transactions as journal
      on journal.id = entry.transaction_id
    where journal.expense_id in (
      select expense_id from public.personal_recurring_occurrences
      where rule_id = (select id from public.personal_recurring_rules where title = 'Rent')
    ) and entry.amount_minor = -80000
  $$,
  $$ values (2::bigint) $$,
  'same-currency auto-post writes one negative wallet entry per rent'
);

reset role;
select results_eq(
  $$
    select private.catch_up_personal_recurring_for(
      'a6600000-0000-4000-8000-000000000001', '2026-02-28'
    ) ->> 'processed'
  $$,
  $$ values ('0'::text) $$,
  'repeating the same catch-up horizon processes nothing twice'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"66000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok(
  $$
    select public.create_personal_recurring_rule(
      '72000000-0000-4000-8000-000000000033',
      'Gym', 'Weekly membership', 2000, 'MYR', 'Health',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      'weekly', null, 1, 'UTC', '00:00',
      '2026-09-21', null, 'review'
    )
  $$,
  'a weekly review rule uses an ISO weekday anchor'
);

reset role;
select lives_ok(
  $$
    select private.catch_up_personal_recurring_for(
      'a6600000-0000-4000-8000-000000000001', '2026-09-28'
    )
  $$,
  'review occurrences can be materialized without posting money'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"66000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq(
  $$
    select count(*)::bigint from public.personal_recurring_occurrences
    where rule_id = (select id from public.personal_recurring_rules where title = 'Gym')
      and status = 'pending_review'
  $$,
  $$ values (2::bigint) $$,
  'review mode creates pending rows without expenses'
);

select lives_ok(
  $$
    select public.update_personal_recurring_occurrence(
      (select id from public.personal_recurring_occurrences
       where rule_id = (select id from public.personal_recurring_rules where title = 'Gym')
         and scheduled_for = '2026-09-21'),
      1, 2500, null, null, null
    )
  $$,
  'one review occurrence can override its amount before posting'
);

select lives_ok(
  $$
    select public.post_personal_recurring_occurrence(
      (select id from public.personal_recurring_occurrences
       where rule_id = (select id from public.personal_recurring_rules where title = 'Gym')
         and scheduled_for = '2026-09-21')
    )
  $$,
  'the owner can confirm one pending review occurrence'
);

select results_eq(
  $$
    select occurrence.effective_amount_minor, expense.total_minor
    from public.personal_recurring_occurrences as occurrence
    join public.expenses as expense on expense.id = occurrence.expense_id
    where occurrence.rule_id = (
      select id from public.personal_recurring_rules where title = 'Gym'
    ) and occurrence.scheduled_for = '2026-09-21'
  $$,
  $$ values (2500::bigint, 2500::bigint) $$,
  'posted snapshots preserve the edit-one amount'
);

select lives_ok(
  $$
    select public.skip_personal_recurring_occurrence(
      (select id from public.personal_recurring_rules where title = 'Gym'),
      '2026-09-28', null
    )
  $$,
  'a materialized review occurrence can be skipped'
);

select results_eq(
  $$
    select status, expense_id from public.personal_recurring_occurrences
    where rule_id = (select id from public.personal_recurring_rules where title = 'Gym')
      and scheduled_for = '2026-09-28'
  $$,
  $$ values ('skipped'::text, null::uuid) $$,
  'skipping creates no Canonical Expense'
);

select lives_ok(
  $$
    select public.set_personal_recurring_paused(
      (select id from public.personal_recurring_rules where title = 'Gym'),
      true,
      (select version from public.personal_recurring_rules where title = 'Gym')
    )
  $$,
  'a rule can be paused with optimistic versioning'
);

select results_eq(
  $$ select paused from public.personal_recurring_rules where title = 'Gym' $$,
  $$ values (true) $$,
  'paused state is persisted explicitly'
);

select lives_ok(
  $$
    select public.set_personal_recurring_paused(
      (select id from public.personal_recurring_rules where title = 'Gym'),
      false,
      (select version from public.personal_recurring_rules where title = 'Gym')
    )
  $$,
  'a paused rule can resume without changing past occurrences'
);

select lives_ok(
  $$
    select public.create_personal_recurring_rule(
      '72000000-0000-4000-8000-000000000034',
      'Phone', 'Phone bill', 9900, 'MYR', 'Utilities',
      (select id from public.personal_accounts where name = 'Old wallet'),
      'monthly', 15, null, 'UTC', '00:00',
      '2026-10-15', null, 'auto_post'
    )
  $$,
  'a second auto-post rule can target another owner account'
);

reset role;
update public.personal_accounts set archived_at = now() where name = 'Old wallet';
select lives_ok(
  $$
    select private.catch_up_personal_recurring_for(
      'a6600000-0000-4000-8000-000000000001', '2026-10-15'
    )
  $$,
  'catch-up continues and records a sanitized failure for an archived account'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"66000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq(
  $$
    select status, error_code from public.personal_recurring_occurrences
    where rule_id = (select id from public.personal_recurring_rules where title = 'Phone')
      and scheduled_for = '2026-10-15'
  $$,
  $$ values ('failed'::text, 'account_archived'::text) $$,
  'failed occurrence exposes an allowlisted error code only'
);

select results_eq(
  $$
    select count(*)::bigint from public.expenses
    where client_request_id = (
      select expense_request_id from public.personal_recurring_occurrences
      where rule_id = (select id from public.personal_recurring_rules where title = 'Phone')
        and scheduled_for = '2026-10-15'
    )
  $$,
  $$ values (0::bigint) $$,
  'failed expense plus funding subtransaction leaves no orphan expense'
);

select lives_ok(
  $$
    select public.update_personal_recurring_rule(
      (select id from public.personal_recurring_rules where title = 'Phone'),
      (select version from public.personal_recurring_rules where title = 'Phone'),
      'Phone', 'Phone bill', 9900, 'MYR', 'Utilities',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      'monthly', 15, null, 'UTC', '00:00',
      '2026-10-15', null, 'auto_post'
    )
  $$,
  'editing future occurrences can replace an archived account'
);

select lives_ok(
  $$
    select public.retry_personal_recurring_occurrence(
      (select id from public.personal_recurring_occurrences
       where rule_id = (select id from public.personal_recurring_rules where title = 'Phone')
         and scheduled_for = '2026-10-15')
    )
  $$,
  'a failed occurrence retries with the corrected current rule'
);

select results_eq(
  $$
    select status, error_code, expense_id is not null
    from public.personal_recurring_occurrences
    where rule_id = (select id from public.personal_recurring_rules where title = 'Phone')
      and scheduled_for = '2026-10-15'
  $$,
  $$ values ('posted'::text, null::text, true) $$,
  'successful retry replaces failed state without duplicating money'
);

select lives_ok(
  $$
    select public.create_personal_recurring_rule(
      '72000000-0000-4000-8000-000000000035',
      'Vietnam rent', 'Foreign rent', 3000000, 'VND', 'Housing',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      'monthly', 20, null, 'UTC', '00:00',
      '2026-11-20', null, 'auto_post'
    )
  $$,
  'cross-currency recurring expense keeps its original currency'
);

reset role;
select lives_ok(
  $$
    select private.catch_up_personal_recurring_for(
      'a6600000-0000-4000-8000-000000000001', '2026-11-20'
    )
  $$,
  'cross-currency rule posts without guessing an account amount'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"66000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq(
  $$
    select occurrence.status, funding.status,
           funding.expense_amount_minor, funding.account_amount_minor
    from public.personal_recurring_occurrences as occurrence
    join public.personal_funding_intents as funding
      on funding.id = occurrence.funding_intent_id
    where occurrence.rule_id = (
      select id from public.personal_recurring_rules where title = 'Vietnam rent'
    ) and occurrence.scheduled_for = '2026-11-20'
  $$,
  $$ values ('posted'::text, 'pending'::text, 3000000::bigint, null::bigint) $$,
  'expense posts while its unknown MYR debit remains pending'
);

select lives_ok(
  $$
    select public.reverse_personal_recurring_occurrence(
      '73000000-0000-4000-8000-000000000035',
      (select id from public.personal_recurring_occurrences
       where rule_id = (select id from public.personal_recurring_rules where title = 'Vietnam rent')
         and scheduled_for = '2026-11-20'),
      (select version from public.personal_recurring_occurrences
       where rule_id = (select id from public.personal_recurring_rules where title = 'Vietnam rent')
         and scheduled_for = '2026-11-20'),
      'Cancelled bill'
    )
  $$,
  'posted occurrence with pending funding can be reversed atomically'
);

select results_eq(
  $$
    select occurrence.status, expense.status, funding.status
    from public.personal_recurring_occurrences as occurrence
    join public.expenses as expense on expense.id = occurrence.expense_id
    join public.personal_funding_intents as funding
      on funding.id = occurrence.funding_intent_id
    where occurrence.rule_id = (
      select id from public.personal_recurring_rules where title = 'Vietnam rent'
    ) and occurrence.scheduled_for = '2026-11-20'
  $$,
  $$ values ('reversed'::text, 'voided'::text, 'cancelled'::text) $$,
  'reverse voids the expense and cancels its no-money funding intent'
);

select lives_ok(
  $$
    select public.reverse_personal_recurring_occurrence(
      '73000000-0000-4000-8000-000000000031',
      (select id from public.personal_recurring_occurrences
       where rule_id = (select id from public.personal_recurring_rules where title = 'Rent')
         and scheduled_for = '2026-01-31'),
      (select version from public.personal_recurring_occurrences
       where rule_id = (select id from public.personal_recurring_rules where title = 'Rent')
         and scheduled_for = '2026-01-31'),
      'Correct rent'
    )
  $$,
  'same-currency recurring money can be reversed with compensating journal entries'
);

select results_eq(
  $$
    select occurrence.status, funding.status,
           funding.reversal_transaction_id is not null
    from public.personal_recurring_occurrences as occurrence
    join public.personal_funding_intents as funding
      on funding.id = occurrence.funding_intent_id
    where occurrence.rule_id = (
      select id from public.personal_recurring_rules where title = 'Rent'
    ) and occurrence.scheduled_for = '2026-01-31'
  $$,
  $$ values ('reversed'::text, 'reversed'::text, true) $$,
  'wallet-funded reverse preserves the original plus exact compensation'
);

reset role;
update public.personal_recurring_rules
set paused = true
where owner_participant_id = 'a6600000-0000-4000-8000-000000000001';

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"66000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok(
  $$
    select public.create_personal_recurring_rule(
      '72000000-0000-4000-8000-000000000036',
      'Backlog', 'Batch bound', 100, 'MYR', 'Other',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      'monthly', 31, null, 'UTC', '00:00',
      '2024-01-31', null, 'auto_post'
    )
  $$,
  'a long-running backlog rule can be created for the batch-bound test'
);

reset role;
select results_eq(
  $$
    select
      (result ->> 'processed')::integer,
      (result ->> 'remaining')::integer
    from (
      select private.catch_up_personal_recurring_for(
        'a6600000-0000-4000-8000-000000000001', '2026-09-30'
      ) as result
    ) as catch_up
  $$,
  $$ values (24::integer, 9::integer) $$,
  'one catch-up call processes at most 24 and reports nine remaining'
);

select results_eq(
  $$
    select
      (result ->> 'processed')::integer,
      (result ->> 'remaining')::integer
    from (
      select private.catch_up_personal_recurring_for(
        'a6600000-0000-4000-8000-000000000001', '2026-09-30'
      ) as result
    ) as catch_up
  $$,
  $$ values (9::integer, 0::integer) $$,
  'a continuation finishes the remaining backlog'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"66000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq(
  $$
    select count(*)::bigint from public.personal_recurring_occurrences
    where rule_id = (select id from public.personal_recurring_rules where title = 'Backlog')
  $$,
  $$ values (33::bigint) $$,
  'bounded continuation materializes every month exactly once'
);

select throws_ok(
  $$
    insert into public.personal_recurring_rules(
      owner_participant_id, client_request_id, payload_fingerprint,
      title, amount_minor, currency, category, funding_account_id,
      cadence, anchor_day_of_month, timezone, local_time,
      start_on, posting_mode, next_due_on
    ) values (
      'a6600000-0000-4000-8000-000000000001',
      '74000000-0000-4000-8000-000000000001', repeat('a', 64),
      'Bypass', 100, 'MYR', 'Other',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      'monthly', 1, 'UTC', '00:00', current_date, 'auto_post', current_date
    )
  $$,
  '42501', null,
  'authenticated clients cannot bypass guarded rule RPCs'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"67000000-0000-4000-8000-000000000002","is_anonymous":false}';

select results_eq(
  $$ select count(*)::bigint from public.personal_recurring_rules $$,
  $$ values (0::bigint) $$,
  'another participant cannot read owner recurring rules'
);

select results_eq(
  $$ select count(*)::bigint from public.personal_recurring_occurrences $$,
  $$ values (0::bigint) $$,
  'another participant cannot read owner recurring occurrences'
);

select throws_ok(
  $$
    select public.post_personal_recurring_occurrence(
      (select id from public.personal_recurring_occurrences limit 1)
    )
  $$,
  'P0001', 'personal_recurring_occurrence_not_found',
  'another participant cannot post an owner occurrence through an RPC'
);

reset role;
select * from finish();
rollback;
