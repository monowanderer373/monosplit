begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-4555-8555-555555555555',
  'authenticated',
  'authenticated',
  'capture@example.test',
  '',
  pg_catalog.now(),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Capture tester"}',
  pg_catalog.now(),
  pg_catalog.now()
);

update public.participants
set id = '55555555-aaaa-4aaa-8aaa-555555555555'
where auth_user_id = '55555555-5555-4555-8555-555555555555';

select is(
  pg_catalog.has_function_privilege(
    'authenticated',
    'public.consume_capture_quota(text,bigint)',
    'EXECUTE'
  ),
  true,
  'authenticated accounts can execute the quota command'
);
select is(
  pg_catalog.has_function_privilege(
    'anon',
    'public.consume_capture_quota(text,bigint)',
    'EXECUTE'
  ),
  false,
  'anonymous callers cannot execute the quota command'
);
select is(
  pg_catalog.has_table_privilege(
    'authenticated',
    'public.capture_usage',
    'INSERT'
  ),
  false,
  'clients cannot write capture usage directly'
);

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"55555555-5555-4555-8555-555555555555","is_anonymous":false}';

select results_eq(
  $$
    select receipt.plan, receipt.usage_count, receipt.quota, receipt.period_month
    from public.consume_capture_quota('natural_language') as receipt
  $$,
  $$
    values (
      'free'::text,
      1::integer,
      100::integer,
      pg_catalog.date_trunc('month', current_date)::date
    )
  $$,
  'a new active free account can consume natural-language quota through the legacy one-argument call'
);
select results_eq(
  $$
    select pg_catalog.count(*)::bigint
    from public.capture_entitlements
    where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555'
      and plan = 'free'
      and status = 'active'
      and trial_ends_at is null
  $$,
  $$ values (1::bigint) $$,
  'quota consumption provisions one active free entitlement'
);
select results_eq(
  $$
    select provider_cost_micros
    from public.capture_usage
    where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555'
      and source = 'natural_language'
  $$,
  $$ values (0::bigint) $$,
  'the compatible one-argument call accounts zero provider cost'
);
select results_eq(
  $$
    select receipt.plan, receipt.usage_count, receipt.quota
    from public.consume_capture_quota('natural_language', 1234) as receipt
  $$,
  $$ values ('free'::text, 2::integer, 100::integer) $$,
  'an optional provider cost is accepted without changing the receipt shape'
);
select results_eq(
  $$
    select provider_cost_micros
    from public.capture_usage
    where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555'
      and source = 'natural_language'
  $$,
  $$ values (1234::bigint) $$,
  'provider cost is accumulated with monthly usage'
);

reset role;
delete from private.capture_rate_limits
where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555';
delete from public.capture_usage
where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555';
update public.capture_entitlements
set capture_quota_monthly = 2
where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555';
set local role authenticated;

select results_eq(
  $$
    select receipt.usage_count, receipt.quota
    from public.consume_capture_quota('natural_language', 100) as receipt
  $$,
  $$ values (1::integer, 2::integer) $$,
  'natural-language capture consumes the first combined text-and-voice unit'
);
select results_eq(
  $$
    select receipt.usage_count, receipt.quota
    from public.consume_capture_quota('voice', 200) as receipt
  $$,
  $$ values (2::integer, 2::integer) $$,
  'voice capture consumes the second combined text-and-voice unit'
);
select throws_ok(
  $$ select * from public.consume_capture_quota('natural_language', 300) $$,
  'P0001',
  'capture_quota_exceeded',
  'cross-source use cannot exceed the combined monthly quota'
);
select results_eq(
  $$
    select source, usage_count, provider_cost_micros
    from public.capture_usage
    where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555'
    order by source
  $$,
  $$
    values
      ('natural_language'::text, 1::integer, 100::bigint),
      ('voice'::text, 1::integer, 200::bigint)
  $$,
  'combined enforcement preserves per-source usage and cost analytics'
);

reset role;
delete from private.capture_rate_limits
where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555';
delete from public.capture_usage
where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555';
update public.capture_entitlements
set ocr_quota_monthly = 1
where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555';
set local role authenticated;

select results_eq(
  $$
    select receipt.usage_count, receipt.quota
    from public.consume_capture_quota('ocr', 700) as receipt
  $$,
  $$ values (1::integer, 1::integer) $$,
  'an active free account can consume its OCR quota'
);
select throws_ok(
  $$ select * from public.consume_capture_quota('ocr', 900) $$,
  'P0001',
  'capture_quota_exceeded',
  'a request beyond the monthly quota is rejected'
);
select results_eq(
  $$
    select usage_count, provider_cost_micros
    from public.capture_usage
    where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555'
      and source = 'ocr'
  $$,
  $$ values (1::integer, 700::bigint) $$,
  'an exceeded quota rolls back both usage and provider cost'
);
select throws_ok(
  $$ select * from public.consume_capture_quota('camera', 1) $$,
  'P0001',
  'invalid_capture_source',
  'an invalid capture source is rejected'
);
select results_eq(
  $$
    select pg_catalog.count(*)::bigint
    from public.capture_usage
    where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555'
  $$,
  $$ values (1::bigint) $$,
  'an invalid source does not create usage'
);

reset role;
update public.capture_entitlements
set status = 'cancelled'
where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555';
set local role authenticated;
select throws_ok(
  $$ select * from public.consume_capture_quota('voice') $$,
  'P0001',
  'capture_entitlement_inactive',
  'a cancelled free entitlement cannot use provider capture'
);

reset role;
set local role authenticated;
select results_eq(
  $$
    select entitlement.plan, entitlement.status, entitlement.trial_ends_at
    from public.ensure_capture_entitlement() as entitlement
  $$,
  $$ values ('free'::text, 'cancelled'::text, null::timestamptz) $$,
  'ensuring an existing entitlement does not reactivate or replace its protected status'
);

reset role;
delete from private.capture_rate_limits
where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555';
delete from public.capture_usage
where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555';
update public.capture_entitlements
set
  status = 'active',
  plan = 'free',
  trial_ends_at = null,
  capture_quota_monthly = 100
where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555';
set local role authenticated;

select lives_ok(
  $$
    do $block$
    begin
      for request_number in 1..10 loop
        perform 1
        from public.consume_capture_quota('voice', 100);
      end loop;
    end
    $block$
  $$,
  'the first ten voice captures for a free account in a minute are accepted'
);
select throws_ok(
  $$ select * from public.consume_capture_quota('voice', 100) $$,
  'P0001',
  'capture_rate_limit_exceeded',
  'the eleventh provider capture in a minute is rate limited'
);
select results_eq(
  $$
    select usage_count, provider_cost_micros
    from public.capture_usage
    where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555'
      and source = 'voice'
  $$,
  $$ values (10::integer, 1000::bigint) $$,
  'a rate-limited call does not consume monthly quota or provider cost'
);

reset role;
select results_eq(
  $$
    select request_count
    from private.capture_rate_limits
    where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555'
      and period_minute = pg_catalog.date_trunc('minute', pg_catalog.now())
  $$,
  $$ values (10::integer) $$,
  'the atomic minute bucket remains capped at ten'
);

update public.capture_entitlements
set status = 'cancelled'
where participant_id = '55555555-aaaa-4aaa-8aaa-555555555555';
set local role authenticated;
select lives_ok(
  $$
    select public.create_expense(
      '55555555-bbbb-4bbb-8bbb-555555555555',
      'personal',
      null,
      2500,
      'MYR',
      'Financial access survives cancellation',
      'Other',
      current_date,
      array['55555555-aaaa-4aaa-8aaa-555555555555'::uuid],
      array[2500::bigint],
      array[2500::bigint]
    )
  $$,
  'a cancelled capture customer can still create a normal financial expense'
);
select results_eq(
  $$
    select pg_catalog.count(*)::bigint
    from public.expenses
    where client_request_id = '55555555-bbbb-4bbb-8bbb-555555555555'
      and created_by = '55555555-aaaa-4aaa-8aaa-555555555555'
      and status = 'active'
  $$,
  $$ values (1::bigint) $$,
  'a cancelled capture customer can still read the normal financial expense'
);

reset role;
select * from finish();
rollback;
