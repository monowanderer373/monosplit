begin;

create extension if not exists pgtap with schema extensions;
select plan(39);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000','71000000-0000-4000-8000-000000000001',
   'authenticated','authenticated','history-owner@example.test','',now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Owner"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','72000000-0000-4000-8000-000000000002',
   'authenticated','authenticated','history-member@example.test','',now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Member"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','73000000-0000-4000-8000-000000000003',
   'authenticated','authenticated','history-creditor@example.test','',now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Creditor"}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','74000000-0000-4000-8000-000000000004',
   'authenticated','authenticated','history-outsider@example.test','',now(),
   '{"provider":"email","providers":["email"]}','{"display_name":"Outsider"}',now(),now());

update public.participants
set id = case auth_user_id
  when '71000000-0000-4000-8000-000000000001' then 'a1000000-0000-4000-8000-000000000001'::uuid
  when '72000000-0000-4000-8000-000000000002' then 'b2000000-0000-4000-8000-000000000002'::uuid
  when '73000000-0000-4000-8000-000000000003' then 'c3000000-0000-4000-8000-000000000003'::uuid
  when '74000000-0000-4000-8000-000000000004' then 'd4000000-0000-4000-8000-000000000004'::uuid
end
where auth_user_id in (
  '71000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000002',
  '73000000-0000-4000-8000-000000000003',
  '74000000-0000-4000-8000-000000000004'
);

insert into public.spaces(
  id, type, name, owner_participant_id, default_currency
)
values (
  'e5000000-0000-4000-8000-000000000005',
  'trip',
  'Interval trip',
  'a1000000-0000-4000-8000-000000000001',
  'MYR'
);

insert into public.space_members(
  space_id, participant_id, role, joined_at
)
values
  ('e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001','owner','2026-01-01 00:00:00+00'),
  ('e5000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000002','view','2026-01-10 00:00:00+00'),
  ('e5000000-0000-4000-8000-000000000005','c3000000-0000-4000-8000-000000000003','full_access','2026-01-01 00:00:00+00');

update public.space_members
set removed_at = '2026-01-20 00:00:00+00'
where space_id = 'e5000000-0000-4000-8000-000000000005'
  and participant_id = 'b2000000-0000-4000-8000-000000000002';

update public.space_members
set joined_at = '2026-02-01 00:00:00+00', removed_at = null
where space_id = 'e5000000-0000-4000-8000-000000000005'
  and participant_id = 'b2000000-0000-4000-8000-000000000002';

select is((
  select relrowsecurity
  from pg_catalog.pg_class
  where oid = 'public.space_membership_intervals'::regclass
),true,'membership intervals have RLS enabled');

select is(pg_catalog.has_table_privilege(
  'authenticated','public.space_membership_intervals','SELECT'
),false,'authenticated clients cannot select membership intervals');

select is(pg_catalog.has_function_privilege(
  'authenticated',
  'private.has_space_membership_at(uuid,uuid,timestamptz)',
  'EXECUTE'
),false,'the membership-time helper is not a client API');

select results_eq($$
  select count(*)::bigint
  from public.space_membership_intervals
  where space_id = 'e5000000-0000-4000-8000-000000000005'
    and participant_id = 'b2000000-0000-4000-8000-000000000002'
$$,$$ values (2::bigint) $$,
'remove and rejoin creates two immutable membership intervals');

select results_eq($$
  select started_at, ended_at
  from public.space_membership_intervals
  where space_id = 'e5000000-0000-4000-8000-000000000005'
    and participant_id = 'b2000000-0000-4000-8000-000000000002'
  order by started_at
  limit 1
$$,$$ values (
  '2026-01-10 00:00:00+00'::timestamptz,
  '2026-01-20 00:00:00+00'::timestamptz
) $$,'the first interval closes at removal');

select results_eq($$
  select count(*)::bigint
  from public.space_membership_intervals
  where space_id = 'e5000000-0000-4000-8000-000000000005'
    and participant_id = 'b2000000-0000-4000-8000-000000000002'
    and started_at = '2026-02-01 00:00:00+00'
    and ended_at is null
$$,$$ values (1::bigint) $$,
'rejoin opens a fresh interval instead of rewriting history');

select results_eq($$
  select count(*)::bigint
  from public.space_membership_intervals
  where space_id = 'e5000000-0000-4000-8000-000000000005'
    and participant_id = 'a1000000-0000-4000-8000-000000000001'
$$,$$ values (1::bigint) $$,
'new owner memberships are tracked automatically');

select throws_ok($$
  insert into public.space_membership_intervals(
    space_id, participant_id, started_at, ended_at
  ) values (
    'e5000000-0000-4000-8000-000000000005',
    'b2000000-0000-4000-8000-000000000002',
    '2026-01-15 00:00:00+00',
    '2026-01-18 00:00:00+00'
  )
$$,'P0001','space_membership_interval_overlap',
'overlapping membership intervals fail closed');

insert into public.expenses(
  id, client_request_id, scope, space_id, created_by, total_minor,
  participant_count, currency, description, category, occurred_on, created_at
)
values
  ('81000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001',1000,1,'MYR','history.pre.hidden','Food','2026-01-05','2026-01-05 00:00:00+00'),
  ('81000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000002','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001',1000,2,'MYR','history.pre.pending','Food','2026-01-06','2026-01-06 00:00:00+00'),
  ('81000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000003','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001',1000,2,'MYR','history.pre.accepted','Food','2026-01-07','2026-01-07 00:00:00+00'),
  ('81000000-0000-4000-8000-000000000004','91000000-0000-4000-8000-000000000004','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001',1000,1,'MYR','history.during','Food','2026-01-15','2026-01-15 00:00:00+00'),
  ('81000000-0000-4000-8000-000000000005','91000000-0000-4000-8000-000000000005','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001',1000,1,'MYR','history.end.boundary','Food','2026-01-20','2026-01-20 00:00:00+00'),
  ('81000000-0000-4000-8000-000000000006','91000000-0000-4000-8000-000000000006','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001',1000,1,'MYR','history.gap','Food','2026-01-25','2026-01-25 00:00:00+00'),
  ('81000000-0000-4000-8000-000000000007','91000000-0000-4000-8000-000000000007','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001',1000,1,'MYR','history.restart.boundary','Food','2026-02-01','2026-02-01 00:00:00+00'),
  ('81000000-0000-4000-8000-000000000008','91000000-0000-4000-8000-000000000008','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001',1000,1,'MYR','history.after','Food','2026-02-05','2026-02-05 00:00:00+00');

insert into public.expense_participations(
  expense_id, participant_id, name_snapshot, participant_order, state, tracking_mode
)
select expense.id,
  'a1000000-0000-4000-8000-000000000001',
  'Owner',
  0,
  'accepted',
  'tracked'
from public.expenses as expense
where expense.description like 'history.%';

insert into public.expense_participations(
  expense_id, participant_id, name_snapshot, participant_order, state, tracking_mode
)
values
  ('81000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000002','Member',1,'pending','tracked'),
  ('81000000-0000-4000-8000-000000000003','b2000000-0000-4000-8000-000000000002','Member',1,'accepted','tracked');

insert into public.expense_shares(
  expense_participation_id, expense_id, amount_minor
)
select participation.id, participation.expense_id, 1000
from public.expense_participations as participation
where participation.expense_id = '81000000-0000-4000-8000-000000000004'
  and participation.participant_id = 'a1000000-0000-4000-8000-000000000001';

insert into public.settlement_payments(
  id, client_request_id, scope, space_id, debtor_participant_id,
  currency, amount_minor, payment_date, created_at
)
values
  ('82000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000001','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001','MYR',1000,'2026-01-05','2026-01-05 00:00:00+00'),
  ('82000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000002','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001','MYR',1000,'2026-01-15','2026-01-15 00:00:00+00'),
  ('82000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000003','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001','MYR',1000,'2026-01-20','2026-01-20 00:00:00+00'),
  ('82000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000004','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001','MYR',1000,'2026-01-25','2026-01-25 00:00:00+00'),
  ('82000000-0000-4000-8000-000000000005','92000000-0000-4000-8000-000000000005','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001','MYR',1000,'2026-02-05','2026-02-05 00:00:00+00'),
  ('82000000-0000-4000-8000-000000000006','92000000-0000-4000-8000-000000000006','space','e5000000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001','MYR',1000,'2026-01-05','2026-01-05 00:00:00+00'),
  ('82000000-0000-4000-8000-000000000007','92000000-0000-4000-8000-000000000007','space','e5000000-0000-4000-8000-000000000005','b2000000-0000-4000-8000-000000000002','MYR',1000,'2026-01-25','2026-01-25 00:00:00+00');

insert into public.settlement_allocations(
  settlement_payment_id, creditor_participant_id, amount_minor
)
values
  ('82000000-0000-4000-8000-000000000001','c3000000-0000-4000-8000-000000000003',1000),
  ('82000000-0000-4000-8000-000000000002','c3000000-0000-4000-8000-000000000003',1000),
  ('82000000-0000-4000-8000-000000000003','c3000000-0000-4000-8000-000000000003',1000),
  ('82000000-0000-4000-8000-000000000004','c3000000-0000-4000-8000-000000000003',1000),
  ('82000000-0000-4000-8000-000000000005','c3000000-0000-4000-8000-000000000003',1000),
  ('82000000-0000-4000-8000-000000000006','b2000000-0000-4000-8000-000000000002',1000),
  ('82000000-0000-4000-8000-000000000007','a1000000-0000-4000-8000-000000000001',1000);

insert into public.financial_events(
  actor_participant_id, space_id, event_type, created_at
)
values
  ('a1000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000005','history.pre.event','2026-01-05 00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000005','history.during.event','2026-01-15 00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000005','history.gap.event','2026-01-25 00:00:00+00'),
  ('a1000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000005','history.after.event','2026-02-05 00:00:00+00');

set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"72000000-0000-4000-8000-000000000002","is_anonymous":false}';

select results_eq($$ select count(*)::bigint from public.expenses where description='history.pre.hidden' $$,$$ values (0::bigint) $$,'a new member cannot read a pre-join expense');
select results_eq($$ select count(*)::bigint from public.expenses where description='history.pre.pending' $$,$$ values (0::bigint) $$,'pending participation does not grant expense visibility');
select results_eq($$ select count(*)::bigint from public.expenses where description='history.pre.accepted' $$,$$ values (1::bigint) $$,'accepted participation grants explicit pre-join visibility');
select results_eq($$ select count(*)::bigint from public.expenses where description='history.during' $$,$$ values (1::bigint) $$,'an expense created during membership is visible');
select results_eq($$ select count(*)::bigint from public.expenses where description='history.end.boundary' $$,$$ values (0::bigint) $$,'the removal timestamp is an exclusive boundary');
select results_eq($$ select count(*)::bigint from public.expenses where description='history.gap' $$,$$ values (0::bigint) $$,'rejoin does not unlock an expense from the membership gap');
select results_eq($$ select count(*)::bigint from public.expenses where description='history.restart.boundary' $$,$$ values (1::bigint) $$,'the rejoin timestamp is an inclusive boundary');
select results_eq($$ select count(*)::bigint from public.expenses where description='history.after' $$,$$ values (1::bigint) $$,'an expense after rejoin is visible');
select results_eq($$ select count(*)::bigint from public.expenses where description like 'history.%' $$,$$ values (4::bigint) $$,'only accepted or in-interval expense headers are visible');
select results_eq($$ select count(*)::bigint from public.expense_participations where expense_id='81000000-0000-4000-8000-000000000002' $$,$$ values (0::bigint) $$,'pending rows cannot leak through the participation policy');
select results_eq($$ select count(*)::bigint from public.expense_participations where expense_id='81000000-0000-4000-8000-000000000003' $$,$$ values (2::bigint) $$,'accepted pre-join access exposes the complete expense participation set');
select results_eq($$ select count(*)::bigint from public.expense_participations where expense_id='81000000-0000-4000-8000-000000000006' $$,$$ values (0::bigint) $$,'gap participations stay private');
select results_eq($$ select count(*)::bigint from public.expense_shares where expense_id='81000000-0000-4000-8000-000000000004' $$,$$ values (1::bigint) $$,'visible expense shares follow the time-bounded header');

select results_eq($$ select count(*)::bigint from public.settlement_payments where id='82000000-0000-4000-8000-000000000001' $$,$$ values (0::bigint) $$,'a non-party cannot read a pre-join settlement');
select results_eq($$ select count(*)::bigint from public.settlement_payments where id='82000000-0000-4000-8000-000000000002' $$,$$ values (1::bigint) $$,'a settlement created during membership is visible');
select results_eq($$ select count(*)::bigint from public.settlement_payments where id='82000000-0000-4000-8000-000000000003' $$,$$ values (0::bigint) $$,'settlement removal boundary is exclusive');
select results_eq($$ select count(*)::bigint from public.settlement_payments where id='82000000-0000-4000-8000-000000000004' $$,$$ values (0::bigint) $$,'a gap settlement stays private after rejoin');
select results_eq($$ select count(*)::bigint from public.settlement_payments where id='82000000-0000-4000-8000-000000000005' $$,$$ values (1::bigint) $$,'a settlement after rejoin is visible');
select results_eq($$ select count(*)::bigint from public.settlement_payments where id='82000000-0000-4000-8000-000000000006' $$,$$ values (1::bigint) $$,'creditor party status overrides the membership cutoff');
select results_eq($$ select count(*)::bigint from public.settlement_payments where id='82000000-0000-4000-8000-000000000007' $$,$$ values (1::bigint) $$,'debtor party status overrides the membership gap');
select results_eq($$ select count(*)::bigint from public.settlement_payments where id between '82000000-0000-4000-8000-000000000001' and '82000000-0000-4000-8000-000000000007' $$,$$ values (4::bigint) $$,'only interval settlements and explicit party settlements are visible');
select results_eq($$ select count(*)::bigint from public.settlement_allocations where settlement_payment_id='82000000-0000-4000-8000-000000000001' $$,$$ values (0::bigint) $$,'hidden settlement allocations do not leak');
select results_eq($$ select count(*)::bigint from public.settlement_allocations where settlement_payment_id='82000000-0000-4000-8000-000000000002' $$,$$ values (1::bigint) $$,'visible settlement allocations follow the parent policy');

select results_eq($$ select count(*)::bigint from public.financial_events where event_type='history.pre.event' $$,$$ values (0::bigint) $$,'pre-join Space events stay hidden');
select results_eq($$ select count(*)::bigint from public.financial_events where event_type='history.during.event' $$,$$ values (1::bigint) $$,'in-interval Space events are visible');
select results_eq($$ select count(*)::bigint from public.financial_events where event_type='history.gap.event' $$,$$ values (0::bigint) $$,'gap Space events stay hidden');
select results_eq($$ select count(*)::bigint from public.financial_events where event_type='history.after.event' $$,$$ values (1::bigint) $$,'post-rejoin Space events are visible');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"74000000-0000-4000-8000-000000000004","is_anonymous":false}';

select results_eq($$ select count(*)::bigint from public.expenses where description like 'history.%' $$,$$ values (0::bigint) $$,'an unrelated UUID cannot read Space expenses');
select results_eq($$ select count(*)::bigint from public.settlement_payments where id between '82000000-0000-4000-8000-000000000001' and '82000000-0000-4000-8000-000000000007' $$,$$ values (0::bigint) $$,'an unrelated UUID cannot read Space settlements');

reset role;
set local role authenticated;
set local "request.jwt.claims" =
  '{"role":"authenticated","sub":"71000000-0000-4000-8000-000000000001","is_anonymous":false}';

select results_eq($$ select count(*)::bigint from public.expenses where description like 'history.%' $$,$$ values (8::bigint) $$,'the expense creator retains all records');
select results_eq($$ select count(*)::bigint from public.settlement_payments where id between '82000000-0000-4000-8000-000000000001' and '82000000-0000-4000-8000-000000000007' $$,$$ values (7::bigint) $$,'a settlement party retains all relevant payments');

select * from finish();
rollback;
