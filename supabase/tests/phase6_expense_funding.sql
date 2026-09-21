begin;

create extension if not exists pgtap with schema extensions;
select plan(45);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '63000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'funding-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Owner"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '64000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'funding-friend@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Lan"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '65000000-0000-4000-8000-000000000003',
    'authenticated', 'authenticated', 'funding-stranger@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Stranger"}',
    now(), now()
  );

update public.participants
set id = case auth_user_id
  when '63000000-0000-4000-8000-000000000001'
    then 'a6300000-0000-4000-8000-000000000001'::uuid
  when '64000000-0000-4000-8000-000000000002'
    then 'b6400000-0000-4000-8000-000000000002'::uuid
  when '65000000-0000-4000-8000-000000000003'
    then 'c6500000-0000-4000-8000-000000000003'::uuid
end
where auth_user_id in (
  '63000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000002',
  '65000000-0000-4000-8000-000000000003'
);

insert into public.friendships(
  participant_low_id, participant_high_id, requested_by, status, accepted_at
)
values (
  'a6300000-0000-4000-8000-000000000001',
  'b6400000-0000-4000-8000-000000000002',
  'a6300000-0000-4000-8000-000000000001',
  'accepted', now()
);

select is(
  (
    select relrowsecurity from pg_catalog.pg_class
    where oid = 'public.personal_funding_intents'::regclass
  ),
  true,
  'funding intents have RLS enabled'
);

select is(
  pg_catalog.has_table_privilege(
    'authenticated', 'public.personal_funding_intents', 'SELECT'
  ),
  true,
  'authenticated clients can select funding intents subject to RLS'
);

select is(
  pg_catalog.has_table_privilege(
    'authenticated', 'public.personal_funding_intents', 'INSERT,UPDATE,DELETE'
  ),
  false,
  'authenticated clients cannot mutate funding intents directly'
);

select is(
  pg_catalog.has_table_privilege(
    'anon', 'public.personal_funding_intents', 'SELECT,INSERT,UPDATE,DELETE'
  ),
  false,
  'anonymous clients have no funding intent privileges'
);

select is(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.link_expense_funding(uuid,uuid,uuid,bigint)',
    'EXECUTE'
  ),
  true,
  'authenticated clients can call the guarded funding linker'
);

select is(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.complete_pending_funding(uuid,uuid,uuid,bigint)',
    'EXECUTE'
  ),
  true,
  'authenticated clients can complete pending funding'
);

select is(
  pg_catalog.has_function_privilege(
    'anon',
    'public.create_expense_with_funding(uuid,text,uuid,bigint,text,text,text,date,uuid[],bigint[],bigint[],uuid,uuid,bigint)',
    'EXECUTE'
  ),
  false,
  'anonymous clients cannot call the expense and funding wrapper'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"63000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok(
  $$
    select public.create_personal_account(
      '71000000-0000-4000-8000-000000000021',
      'Touch n Go', 'ewallet', 'MYR', null, null, true
    )
  $$,
  'the owner can create an asset account for expense funding'
);

select lives_ok(
  $$
    select public.create_personal_account(
      '71000000-0000-4000-8000-000000000022',
      'CIMB Credit', 'credit_card', 'MYR', null, null, false
    )
  $$,
  'the owner can create a liability account for card purchases'
);

select lives_ok(
  $$
    select public.create_expense_with_funding(
      '72000000-0000-4000-8000-000000000021',
      'personal', null, 1500, 'MYR', 'Iced latte', 'Food', current_date,
      array['a6300000-0000-4000-8000-000000000001'::uuid],
      array[1500::bigint], array[1500::bigint],
      '73000000-0000-4000-8000-000000000021',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      null
    )
  $$,
  'same-currency expense creation and account funding are atomic'
);

select results_eq(
  $$
    select status, expense_amount_minor, expense_currency,
           account_amount_minor, account_currency
    from public.personal_funding_intents
    where client_request_id = '73000000-0000-4000-8000-000000000021'
  $$,
  $$ values ('posted'::text, 1500::bigint, 'MYR'::text, 1500::bigint, 'MYR'::text) $$,
  'same-currency funding defaults the account amount to the accepted contribution'
);

select results_eq(
  $$
    select journal.kind, entry.amount_minor
    from public.personal_funding_intents as funding
    join public.personal_account_transactions as journal
      on journal.id = funding.posted_transaction_id
    join public.personal_account_entries as entry
      on entry.transaction_id = journal.id
    where funding.client_request_id = '73000000-0000-4000-8000-000000000021'
  $$,
  $$ values ('expense_funding'::text, (-1500)::bigint) $$,
  'asset funding posts one negative account leg'
);

select lives_ok(
  $$
    select public.create_expense_with_funding(
      '72000000-0000-4000-8000-000000000021',
      'personal', null, 1500, 'MYR', 'Iced latte', 'Food', current_date,
      array['a6300000-0000-4000-8000-000000000001'::uuid],
      array[1500::bigint], array[1500::bigint],
      '73000000-0000-4000-8000-000000000021',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      null
    )
  $$,
  'an identical expense and funding retry is idempotent'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.personal_funding_intents
    where client_request_id = '73000000-0000-4000-8000-000000000021'
  $$,
  $$ values (1::bigint) $$,
  'an identical retry does not mint another funding intent'
);

select throws_ok(
  $$
    select public.create_expense_with_funding(
      '72000000-0000-4000-8000-000000000021',
      'personal', null, 1600, 'MYR', 'Iced latte', 'Food', current_date,
      array['a6300000-0000-4000-8000-000000000001'::uuid],
      array[1600::bigint], array[1600::bigint],
      '73000000-0000-4000-8000-000000000021',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      null
    )
  $$,
  'P0001', 'idempotency_conflict',
  'a changed expense retry is rejected before funding can drift'
);

select lives_ok(
  $$
    select public.create_expense(
      '72000000-0000-4000-8000-000000000022',
      'personal', null, 300000, 'VND', 'Dinner', 'Food', current_date,
      array['a6300000-0000-4000-8000-000000000001'::uuid],
      array[300000::bigint], array[300000::bigint]
    )
  $$,
  'a foreign-currency canonical expense can be created independently'
);

select lives_ok(
  $$
    select public.link_expense_funding(
      '73000000-0000-4000-8000-000000000022',
      (select id from public.expenses
       where client_request_id = '72000000-0000-4000-8000-000000000022'),
      (select id from public.personal_accounts where name = 'Touch n Go'),
      null
    )
  $$,
  'unknown cross-currency account funding may be saved as pending'
);

select results_eq(
  $$
    select status, expense_amount_minor, expense_currency,
           account_amount_minor, account_currency, posted_transaction_id
    from public.personal_funding_intents
    where client_request_id = '73000000-0000-4000-8000-000000000022'
  $$,
  $$
    values (
      'pending'::text, 300000::bigint, 'VND'::text,
      null::bigint, 'MYR'::text, null::uuid
    )
  $$,
  'pending funding preserves the expense currency without guessing MYR'
);

select results_eq(
  $$
    select count(*)::bigint from public.personal_account_transactions
    where expense_id = (
      select id from public.expenses
      where client_request_id = '72000000-0000-4000-8000-000000000022'
    )
  $$,
  $$ values (0::bigint) $$,
  'pending funding does not change the account balance prematurely'
);

select lives_ok(
  $$
    select public.complete_pending_funding(
      '74000000-0000-4000-8000-000000000022',
      (select id from public.personal_funding_intents
       where client_request_id = '73000000-0000-4000-8000-000000000022'),
      (select id from public.personal_accounts where name = 'Touch n Go'),
      5680
    )
  $$,
  'the owner can later post the real account-currency amount'
);

select results_eq(
  $$
    select funding.status, funding.account_amount_minor, entry.amount_minor
    from public.personal_funding_intents as funding
    join public.personal_account_entries as entry
      on entry.transaction_id = funding.posted_transaction_id
    where funding.client_request_id = '73000000-0000-4000-8000-000000000022'
  $$,
  $$ values ('posted'::text, 5680::bigint, (-5680)::bigint) $$,
  'completion stores the actual MYR amount and one negative asset leg'
);

select lives_ok(
  $$
    select public.complete_pending_funding(
      '74000000-0000-4000-8000-000000000022',
      (select id from public.personal_funding_intents
       where client_request_id = '73000000-0000-4000-8000-000000000022'),
      (select id from public.personal_accounts where name = 'Touch n Go'),
      5680
    )
  $$,
  'an identical pending-completion retry is idempotent'
);

select results_eq(
  $$
    select count(*)::bigint from public.personal_account_transactions
    where client_request_id = '74000000-0000-4000-8000-000000000022'
  $$,
  $$ values (1::bigint) $$,
  'completion retry does not double-debit the account'
);

select throws_ok(
  $$
    select public.complete_pending_funding(
      '74000000-0000-4000-8000-000000000022',
      (select id from public.personal_funding_intents
       where client_request_id = '73000000-0000-4000-8000-000000000022'),
      (select id from public.personal_accounts where name = 'Touch n Go'),
      5700
    )
  $$,
  'P0001', 'idempotency_conflict',
  'completion request IDs cannot be reused with another actual amount'
);

select lives_ok(
  $$
    select public.create_expense_with_funding(
      '72000000-0000-4000-8000-000000000023',
      'personal', null, 65000, 'VND', 'Coffee', 'Food', current_date,
      array['a6300000-0000-4000-8000-000000000001'::uuid],
      array[65000::bigint], array[65000::bigint],
      '73000000-0000-4000-8000-000000000023', null, null
    )
  $$,
  'an expense can be saved before the owner chooses a funding account'
);

select results_eq(
  $$
    select status, account_id, account_currency
    from public.personal_funding_intents
    where client_request_id = '73000000-0000-4000-8000-000000000023'
  $$,
  $$ values ('pending'::text, null::uuid, null::text) $$,
  'an unlinked pending item does not pretend to know its wallet'
);

select lives_ok(
  $$
    select public.complete_pending_funding(
      '74000000-0000-4000-8000-000000000023',
      (select id from public.personal_funding_intents
       where client_request_id = '73000000-0000-4000-8000-000000000023'),
      (select id from public.personal_accounts where name = 'Touch n Go'),
      1230
    )
  $$,
  'an unlinked pending item can choose its account during completion'
);

select lives_ok(
  $$
    select public.create_expense_with_funding(
      '72000000-0000-4000-8000-000000000024',
      'personal', null, 600000, 'VND', 'Hotel', 'Travel', current_date,
      array['a6300000-0000-4000-8000-000000000001'::uuid],
      array[600000::bigint], array[600000::bigint],
      '73000000-0000-4000-8000-000000000024',
      (select id from public.personal_accounts where name = 'CIMB Credit'),
      11360
    )
  $$,
  'a foreign-currency card purchase records explicit MYR principal'
);

select results_eq(
  $$
    select journal.kind, entry.amount_minor
    from public.personal_funding_intents as funding
    join public.personal_account_transactions as journal
      on journal.id = funding.posted_transaction_id
    join public.personal_account_entries as entry
      on entry.transaction_id = journal.id
    where funding.client_request_id = '73000000-0000-4000-8000-000000000024'
  $$,
  $$ values ('liability_purchase'::text, 11360::bigint) $$,
  'credit funding increases liability instead of reducing an asset wallet'
);

select lives_ok(
  $$
    select public.create_expense(
      '72000000-0000-4000-8000-000000000025',
      'direct', null, 10000, 'MYR', 'Dinner for two', 'Food', current_date,
      array[
        'a6300000-0000-4000-8000-000000000001'::uuid,
        'b6400000-0000-4000-8000-000000000002'::uuid
      ],
      array[7000::bigint, 3000::bigint],
      array[5000::bigint, 5000::bigint]
    )
  $$,
  'a Direct expense may have several payers'
);

select lives_ok(
  $$
    select public.link_expense_funding(
      '73000000-0000-4000-8000-000000000025',
      (select id from public.expenses
       where client_request_id = '72000000-0000-4000-8000-000000000025'),
      (select id from public.personal_accounts where name = 'Touch n Go'),
      null
    )
  $$,
  'the owner can fund only the accepted contribution belonging to them'
);

select results_eq(
  $$
    select funding.expense_amount_minor, funding.account_amount_minor,
           expense.total_minor
    from public.personal_funding_intents as funding
    join public.expenses as expense on expense.id = funding.expense_id
    where funding.client_request_id = '73000000-0000-4000-8000-000000000025'
  $$,
  $$ values (7000::bigint, 7000::bigint, 10000::bigint) $$,
  'wallet funding uses the owner contribution rather than the group total'
);

select throws_ok(
  $$
    select public.link_expense_funding(
      '73000000-0000-4000-8000-000000000026',
      (select id from public.expenses
       where client_request_id = '72000000-0000-4000-8000-000000000025'),
      (select id from public.personal_accounts where name = 'Touch n Go'),
      null
    )
  $$,
  'P0001', 'funding_intent_exists',
  'one active wallet funding intent is allowed per expense and owner'
);

select lives_ok(
  $$
    select public.create_expense(
      '72000000-0000-4000-8000-000000000026',
      'direct', null, 1000, 'MYR', 'Friend paid', 'Other', current_date,
      array[
        'a6300000-0000-4000-8000-000000000001'::uuid,
        'b6400000-0000-4000-8000-000000000002'::uuid
      ],
      array[0::bigint, 1000::bigint],
      array[500::bigint, 500::bigint]
    )
  $$,
  'a Direct expense can record that the friend paid the full bill'
);

select throws_ok(
  $$
    select public.link_expense_funding(
      '73000000-0000-4000-8000-000000000027',
      (select id from public.expenses
       where client_request_id = '72000000-0000-4000-8000-000000000026'),
      (select id from public.personal_accounts where name = 'Touch n Go'),
      null
    )
  $$,
  'P0001', 'owner_payer_contribution_required',
  'an owner who paid nothing cannot fabricate a private wallet debit'
);

select lives_ok(
  $$
    select public.reverse_personal_account_transaction(
      '75000000-0000-4000-8000-000000000025',
      (
        select posted_transaction_id from public.personal_funding_intents
        where client_request_id = '73000000-0000-4000-8000-000000000025'
      ),
      current_date,
      'Correct wallet'
    )
  $$,
  'a posted wallet funding movement can be reversed through the journal'
);

select results_eq(
  $$
    select status, reversal_transaction_id is not null, reversed_at is not null
    from public.personal_funding_intents
    where client_request_id = '73000000-0000-4000-8000-000000000025'
  $$,
  $$ values ('reversed'::text, true, true) $$,
  'journal reversal moves the funding intent to an auditable reversed state'
);

select lives_ok(
  $$
    select public.link_expense_funding(
      '73000000-0000-4000-8000-000000000028',
      (select id from public.expenses
       where client_request_id = '72000000-0000-4000-8000-000000000025'),
      (select id from public.personal_accounts where name = 'Touch n Go'),
      null
    )
  $$,
  'a corrected funding intent can be posted after the original is reversed'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.personal_funding_intents
    where expense_id = (
      select id from public.expenses
      where client_request_id = '72000000-0000-4000-8000-000000000025'
    )
  $$,
  $$ values (2::bigint) $$,
  'correction preserves both the reversed history and the replacement intent'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"64000000-0000-4000-8000-000000000002","is_anonymous":false}';

select results_eq(
  $$ select count(*)::bigint from public.personal_funding_intents $$,
  $$ values (0::bigint) $$,
  'a Direct-expense friend cannot read the owner private funding intents'
);

select results_eq(
  $$ select count(*)::bigint from public.personal_account_transactions $$,
  $$ values (0::bigint) $$,
  'a Direct-expense friend cannot read the owner private journal'
);

select throws_ok(
  $$
    select public.complete_pending_funding(
      '76000000-0000-4000-8000-000000000001',
      '73000000-0000-4000-8000-000000000022',
      null,
      1
    )
  $$,
  'P0001', 'funding_intent_not_found',
  'a friend cannot mutate another owner funding intent through an RPC'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"65000000-0000-4000-8000-000000000003","is_anonymous":false}';

select results_eq(
  $$ select count(*)::bigint from public.personal_funding_intents $$,
  $$ values (0::bigint) $$,
  'an unrelated participant cannot enumerate private funding intents'
);

select results_eq(
  $$ select count(*)::bigint from public.personal_account_events $$,
  $$ values (0::bigint) $$,
  'an unrelated participant cannot enumerate private funding audit events'
);

select throws_ok(
  $$
    insert into public.personal_funding_intents(
      owner_participant_id, client_request_id, payload_fingerprint,
      expense_id, expense_amount_minor, expense_currency
    ) values (
      'c6500000-0000-4000-8000-000000000003',
      '77000000-0000-4000-8000-000000000001',
      repeat('a', 64),
      (select id from public.expenses limit 1),
      100, 'MYR'
    )
  $$,
  '42501', null,
  'authenticated clients cannot bypass guarded RPCs with a direct insert'
);

reset role;
select * from finish();
rollback;
