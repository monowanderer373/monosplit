begin;

create extension if not exists pgtap with schema extensions;
select plan(57);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '61000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'phase6-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Owner"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '62000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'phase6-stranger@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"display_name":"Stranger"}',
    now(), now()
  );

update public.participants
set id = case auth_user_id
  when '61000000-0000-4000-8000-000000000001'
    then 'a6100000-0000-4000-8000-000000000001'::uuid
  when '62000000-0000-4000-8000-000000000002'
    then 'b6200000-0000-4000-8000-000000000002'::uuid
end
where auth_user_id in (
  '61000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000002'
);

select results_eq(
  $$
    select count(*)::bigint
    from pg_catalog.pg_class
    where oid in (
      'public.personal_accounts'::regclass,
      'public.personal_account_transactions'::regclass,
      'public.personal_account_entries'::regclass,
      'public.personal_account_events'::regclass
    ) and relrowsecurity
  $$,
  $$ values (4::bigint) $$,
  'RLS is enabled on all owner-private account tables'
);

select is(
  pg_catalog.has_table_privilege('authenticated', 'public.personal_accounts', 'SELECT'),
  true,
  'authenticated clients can select personal accounts subject to RLS'
);

select is(
  (
    pg_catalog.has_table_privilege('authenticated', 'public.personal_accounts', 'INSERT,UPDATE,DELETE')
    or pg_catalog.has_table_privilege('authenticated', 'public.personal_account_transactions', 'INSERT,UPDATE,DELETE')
    or pg_catalog.has_table_privilege('authenticated', 'public.personal_account_entries', 'INSERT,UPDATE,DELETE')
    or pg_catalog.has_table_privilege('authenticated', 'public.personal_account_events', 'INSERT,UPDATE,DELETE')
  ),
  false,
  'authenticated clients cannot mutate owner-private tables directly'
);

select is(
  (
    pg_catalog.has_table_privilege('anon', 'public.personal_accounts', 'SELECT,INSERT,UPDATE,DELETE')
    or pg_catalog.has_table_privilege('anon', 'public.personal_account_transactions', 'SELECT,INSERT,UPDATE,DELETE')
    or pg_catalog.has_table_privilege('anon', 'public.personal_account_entries', 'SELECT,INSERT,UPDATE,DELETE')
    or pg_catalog.has_table_privilege('anon', 'public.personal_account_events', 'SELECT,INSERT,UPDATE,DELETE')
  ),
  false,
  'anonymous clients have no personal account table privileges'
);

select is(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.create_personal_account(uuid,text,text,text,bigint,date,boolean)',
    'EXECUTE'
  ),
  true,
  'authenticated clients can call the guarded account creator'
);

select is(
  pg_catalog.has_function_privilege(
    'anon',
    'public.create_personal_account(uuid,text,text,text,bigint,date,boolean)',
    'EXECUTE'
  ),
  false,
  'anonymous clients cannot call the account creator'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"61000000-0000-4000-8000-000000000001","is_anonymous":false}';

select lives_ok(
  $$
    select public.create_personal_account(
      '71000000-0000-4000-8000-000000000001',
      'Touch n Go', 'ewallet', 'MYR', null, null, false
    )
  $$,
  'the owner can create an account with an unknown opening balance'
);

select results_eq(
  $$
    select name, account_class, account_type, currency, is_default
    from public.personal_accounts
    where client_request_id = '71000000-0000-4000-8000-000000000001'
  $$,
  $$ values ('Touch n Go'::text, 'asset'::text, 'ewallet'::text, 'MYR'::text, true) $$,
  'the first eligible asset becomes the single global default'
);

select results_eq(
  $$
    select opening_status, opening_balance_as_of
    from public.personal_accounts
    where client_request_id = '71000000-0000-4000-8000-000000000001'
  $$,
  $$ values ('unknown'::text, null::date) $$,
  'an omitted opening balance remains unknown rather than zero'
);

select lives_ok(
  $$
    select public.create_personal_account(
      '71000000-0000-4000-8000-000000000001',
      'Touch n Go', 'ewallet', 'MYR', null, null, false
    )
  $$,
  'an identical create-account retry is idempotent'
);

select results_eq(
  $$
    select count(*)::bigint from public.personal_accounts
    where client_request_id = '71000000-0000-4000-8000-000000000001'
  $$,
  $$ values (1::bigint) $$,
  'an idempotent retry does not mint a second account'
);

select throws_ok(
  $$
    select public.create_personal_account(
      '71000000-0000-4000-8000-000000000001',
      'Different', 'ewallet', 'MYR', null, null, false
    )
  $$,
  'P0001', 'idempotency_conflict',
  'reusing a create request with another payload fails deterministically'
);

select lives_ok(
  $$
    select public.create_personal_account(
      '72000000-0000-4000-8000-000000000002',
      'CIMB', 'bank', 'MYR', 50000, current_date, false
    )
  $$,
  'an account can be created atomically with a known opening balance'
);

select results_eq(
  $$
    select name from public.personal_accounts where is_default order by name
  $$,
  $$ values ('Touch n Go'::text) $$,
  'a second asset does not replace the existing default implicitly'
);

select results_eq(
  $$
    select opening_status, opening_balance_as_of
    from public.personal_accounts
    where client_request_id = '72000000-0000-4000-8000-000000000002'
  $$,
  $$ values ('posted'::text, current_date) $$,
  'known opening metadata is cached consistently'
);

select results_eq(
  $$
    select entry.amount_minor
    from public.personal_account_entries as entry
    join public.personal_accounts as account on account.id = entry.account_id
    join public.personal_account_transactions as journal on journal.id = entry.transaction_id
    where account.client_request_id = '72000000-0000-4000-8000-000000000002'
      and journal.kind = 'opening'
  $$,
  $$ values (50000::bigint) $$,
  'a known opening is represented by exactly one signed entry'
);

select lives_ok(
  $$
    select public.create_personal_account(
      '72500000-0000-4000-8000-000000000002',
      'Shopee PayLater', 'paylater', 'MYR', null, null, false
    )
  $$,
  'a liability account may start with an unknown opening balance'
);

select lives_ok(
  $$
    select public.complete_account_opening(
      '72600000-0000-4000-8000-000000000002',
      (select id from public.personal_accounts where name = 'Shopee PayLater'),
      0,
      current_date,
      1
    )
  $$,
  'an unknown opening can later be confirmed as a real zero balance'
);

select results_eq(
  $$
    select account.opening_status, account.opening_balance_as_of, entry.amount_minor
    from public.personal_accounts as account
    join public.personal_account_entries as entry on entry.account_id = account.id
    join public.personal_account_transactions as journal on journal.id = entry.transaction_id
    where account.name = 'Shopee PayLater' and journal.kind = 'opening'
  $$,
  $$ values ('posted'::text, current_date, 0::bigint) $$,
  'a confirmed zero opening stays distinct from an unknown opening'
);

select lives_ok(
  $$
    select public.complete_account_opening(
      '72600000-0000-4000-8000-000000000002',
      (select id from public.personal_accounts where name = 'Shopee PayLater'),
      0,
      current_date,
      1
    )
  $$,
  'an identical opening-completion retry returns the original transaction'
);

select throws_ok(
  $$
    select public.complete_account_opening(
      '72700000-0000-4000-8000-000000000002',
      (select id from public.personal_accounts where name = 'Shopee PayLater'),
      31000,
      current_date,
      2
    )
  $$,
  'P0001', 'opening_already_posted',
  'a posted opening cannot be silently replaced by another amount'
);

select throws_ok(
  $$
    select public.set_default_personal_account(
      '73000000-0000-4000-8000-000000000003',
      (select id from public.personal_accounts where name = 'CIMB'),
      1
    )
  $$,
  'P0001', 'version_conflict',
  'default changes require the current account version'
);

select lives_ok(
  $$
    select public.set_default_personal_account(
      '73000000-0000-4000-8000-000000000003',
      (select id from public.personal_accounts where name = 'CIMB'),
      2
    )
  $$,
  'the owner can explicitly change the global default'
);

select results_eq(
  $$ select name from public.personal_accounts where is_default $$,
  $$ values ('CIMB'::text) $$,
  'only the selected account remains the global default'
);

select throws_ok(
  $$
    select public.archive_personal_account(
      '74000000-0000-4000-8000-000000000004',
      (select id from public.personal_accounts where name = 'CIMB'),
      null,
      3
    )
  $$,
  'P0001', 'replacement_default_required',
  'archiving a default requires a replacement while another asset remains'
);

select lives_ok(
  $$
    select public.create_income_transaction(
      '75000000-0000-4000-8000-000000000005',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      25000,
      current_date,
      'Salary'
    )
  $$,
  'income posts one positive asset entry'
);

select lives_ok(
  $$
    select public.create_income_transaction(
      '75000000-0000-4000-8000-000000000005',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      25000,
      current_date,
      'Salary'
    )
  $$,
  'an identical income retry is idempotent'
);

select results_eq(
  $$
    select count(*)::bigint from public.personal_account_transactions
    where client_request_id = '75000000-0000-4000-8000-000000000005'
  $$,
  $$ values (1::bigint) $$,
  'an income retry does not mint a second transaction'
);

select results_eq(
  $$
    select coalesce(sum(entry.amount_minor), 0)::bigint
    from public.personal_account_entries as entry
    join public.personal_accounts as account on account.id = entry.account_id
    where account.name = 'Touch n Go'
  $$,
  $$ values (25000::bigint) $$,
  'the signed journal produces the expected TNG subtotal'
);

select lives_ok(
  $$
    select public.create_transfer_transaction(
      '76000000-0000-4000-8000-000000000006',
      (select id from public.personal_accounts where name = 'CIMB'),
      10000,
      (select id from public.personal_accounts where name = 'Touch n Go'),
      10000,
      current_date,
      'Wallet top up'
    )
  $$,
  'a same-currency transfer posts atomically'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.personal_account_entries as entry
    join public.personal_account_transactions as journal on journal.id = entry.transaction_id
    where journal.client_request_id = '76000000-0000-4000-8000-000000000006'
  $$,
  $$ values (2::bigint) $$,
  'a transfer contains exactly two account legs'
);

select results_eq(
  $$
    select account.name, sum(entry.amount_minor)::bigint
    from public.personal_accounts as account
    join public.personal_account_entries as entry on entry.account_id = account.id
    group by account.name
    order by account.name
  $$,
  $$ values
    ('CIMB'::text, 40000::bigint),
    ('Shopee PayLater'::text, 0::bigint),
    ('Touch n Go'::text, 35000::bigint)
  $$,
  'a transfer changes both account balances without creating income or expense'
);

select throws_ok(
  $$
    select public.create_transfer_transaction(
      '77000000-0000-4000-8000-000000000007',
      (select id from public.personal_accounts where name = 'CIMB'),
      1000,
      (select id from public.personal_accounts where name = 'Touch n Go'),
      900,
      current_date,
      'Invalid MYR transfer'
    )
  $$,
  'P0001', 'same_currency_transfer_mismatch',
  'same-currency transfers must use equal absolute amounts'
);

select lives_ok(
  $$
    select public.reverse_personal_account_transaction(
      '78000000-0000-4000-8000-000000000008',
      (select id from public.personal_account_transactions
       where client_request_id = '75000000-0000-4000-8000-000000000005'),
      current_date,
      'Undo salary'
    )
  $$,
  'reversal creates exact compensating entries'
);

select results_eq(
  $$
    select sum(entry.amount_minor)::bigint
    from public.personal_account_entries as entry
    join public.personal_accounts as account on account.id = entry.account_id
    where account.name = 'Touch n Go'
  $$,
  $$ values (10000::bigint) $$,
  'the original entry remains in the sum and its reversal restores the prior balance'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.personal_account_transactions
    where client_request_id in (
      '75000000-0000-4000-8000-000000000005',
      '78000000-0000-4000-8000-000000000008'
    )
  $$,
  $$ values (2::bigint) $$,
  'reversal preserves the original transaction as immutable history'
);

select throws_ok(
  $$
    select public.reverse_personal_account_transaction(
      '79000000-0000-4000-8000-000000000009',
      (select id from public.personal_account_transactions
       where client_request_id = '75000000-0000-4000-8000-000000000005'),
      current_date,
      'Reverse again'
    )
  $$,
  'P0001', 'transaction_already_reversed',
  'one original transaction can be reversed only once'
);

select throws_ok(
  $$
    select public.reverse_personal_account_transaction(
      '7a000000-0000-4000-8000-00000000000a',
      (select id from public.personal_account_transactions
       where client_request_id = '78000000-0000-4000-8000-000000000008'),
      current_date,
      'Reverse reversal'
    )
  $$,
  'P0001', 'reversal_of_reversal_forbidden',
  'reversal of a reversal is forbidden'
);

select lives_ok(
  $$
    select public.reconcile_account_to_stated_balance(
      '7b000000-0000-4000-8000-00000000000b',
      (select id from public.personal_accounts where name = 'CIMB'),
      55000,
      current_date,
      'Statement balance',
      4
    )
  $$,
  'a known-opening account can be reconciled to a real statement balance'
);

select results_eq(
  $$
    select sum(entry.amount_minor)::bigint
    from public.personal_account_entries as entry
    join public.personal_accounts as account on account.id = entry.account_id
    where account.name = 'CIMB'
  $$,
  $$ values (55000::bigint) $$,
  'reconciliation writes only the required delta'
);

select throws_ok(
  $$
    select public.reconcile_account_to_stated_balance(
      '7c000000-0000-4000-8000-00000000000c',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      10000,
      current_date,
      'Unknown opening',
      5
    )
  $$,
  'P0001', 'opening_balance_required',
  'an unknown opening cannot be presented as a reconcilable exact balance'
);

select lives_ok(
  $$
    select public.create_refund_transaction(
      '7d000000-0000-4000-8000-00000000000d',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      500,
      current_date,
      null,
      'Cashback'
    )
  $$,
  'a personal refund posts as a positive asset movement'
);

select results_eq(
  $$
    select sum(entry.amount_minor)::bigint
    from public.personal_account_entries as entry
    join public.personal_accounts as account on account.id = entry.account_id
    where account.name = 'Touch n Go'
  $$,
  $$ values (10500::bigint) $$,
  'refund money is fully reflected in the receiving account'
);

select lives_ok(
  $$
    select public.update_personal_account(
      '7e000000-0000-4000-8000-00000000000e',
      (select id from public.personal_accounts where name = 'Touch n Go'),
      'TNG eWallet',
      6
    )
  $$,
  'the owner can rename an active account with optimistic versioning'
);

select results_eq(
  $$ select name from public.personal_accounts where name = 'TNG eWallet' $$,
  $$ values ('TNG eWallet'::text) $$,
  'account metadata update is persisted'
);

select lives_ok(
  $$
    select public.archive_personal_account(
      '7f000000-0000-4000-8000-00000000000f',
      (select id from public.personal_accounts where name = 'CIMB'),
      (select id from public.personal_accounts where name = 'TNG eWallet'),
      5
    )
  $$,
  'archiving the default succeeds when an eligible replacement is supplied'
);

select results_eq(
  $$
    select name, archived_at is not null, is_default
    from public.personal_accounts order by name
  $$,
  $$
    values
      ('CIMB'::text, true, false),
      ('Shopee PayLater'::text, false, false),
      ('TNG eWallet'::text, false, true)
  $$,
  'archiving moves the global default without deleting financial history'
);

select results_eq(
  $$
    select opening_status, sum(entry.amount_minor)::bigint
    from public.personal_accounts as account
    join public.personal_account_entries as entry on entry.account_id = account.id
    where account.name = 'TNG eWallet'
    group by opening_status
  $$,
  $$ values ('unknown'::text, 10500::bigint) $$,
  'later movements do not silently turn an unknown opening into a fake exact balance'
);

select lives_ok(
  $$
    select public.archive_personal_account(
      '80000000-0000-4000-8000-000000000010',
      (select id from public.personal_accounts where name = 'TNG eWallet'),
      null,
      8
    )
  $$,
  'the final eligible asset can be archived without inventing a replacement'
);

select results_eq(
  $$ select count(*)::bigint from public.personal_accounts where is_default $$,
  $$ values (0::bigint) $$,
  'archiving the last eligible account leaves the owner without a default'
);

select results_eq(
  $$ select count(*)::bigint from public.personal_accounts where archived_at is not null $$,
  $$ values (2::bigint) $$,
  'archiving preserves both account rows'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"62000000-0000-4000-8000-000000000002","is_anonymous":false}';

select results_eq(
  $$ select count(*)::bigint from public.personal_accounts $$,
  $$ values (0::bigint) $$,
  'another participant cannot read the owner accounts'
);

select results_eq(
  $$ select count(*)::bigint from public.personal_account_transactions $$,
  $$ values (0::bigint) $$,
  'another participant cannot read the owner transactions'
);

select results_eq(
  $$ select count(*)::bigint from public.personal_account_entries $$,
  $$ values (0::bigint) $$,
  'another participant cannot read the owner entries'
);

select results_eq(
  $$ select count(*)::bigint from public.personal_account_events $$,
  $$ values (0::bigint) $$,
  'another participant cannot read the owner audit events'
);

select throws_ok(
  $$
    select public.update_personal_account(
      '81000000-0000-4000-8000-000000000011',
      (select id from public.personal_accounts limit 1),
      'Stolen',
      1
    )
  $$,
  'P0001', 'personal_account_not_found',
  'another participant cannot mutate an owner account through a guarded RPC'
);

select throws_ok(
  $$
    insert into public.personal_accounts(
      owner_participant_id, client_request_id, creation_payload_fingerprint,
      name, account_class, account_type, currency
    ) values (
      'b6200000-0000-4000-8000-000000000002',
      '82000000-0000-4000-8000-000000000012',
      repeat('a', 64), 'Bypass', 'asset', 'cash', 'MYR'
    )
  $$,
  '42501', null,
  'authenticated clients cannot bypass guarded RPCs with a direct insert'
);

reset role;
select * from finish();
rollback;
