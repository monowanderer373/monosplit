begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000'::uuid,
  ('94000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
  'authenticated','authenticated','direct-review-' || n || '@example.test','',now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name','Review ' || n),now(),now()
from generate_series(1,3) as n;
update public.participants
set id = ('95000000-0000-4000-8000-' || right(auth_user_id::text,12))::uuid
where auth_user_id::text like '94000000-0000-4000-8000-%';
insert into public.friendships(participant_low_id,participant_high_id,requested_by,status,accepted_at)
values ('95000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000002',
  '95000000-0000-4000-8000-000000000001','accepted',now());

create function pg_temp.review_login(n integer) returns text language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('role','authenticated',
    'sub','94000000-0000-4000-8000-' || lpad(n::text,12,'0'),'is_anonymous',false)::text,true);
$$;
create function pg_temp.review_create(n integer) returns uuid language sql as $$
  select public.create_expense(('96000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
    'direct',null,1000,'MYR','Pending review ' || n,'Other','2026-10-09',
    array['95000000-0000-4000-8000-000000000001'::uuid,'95000000-0000-4000-8000-000000000002'::uuid],
    array[1000::bigint,0::bigint],array[500::bigint,500::bigint]);
$$;
create function pg_temp.review_id(n integer) returns uuid language sql as $$
  select id from public.expenses where client_request_id =
    ('96000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid;
$$;

set local role authenticated;
select pg_temp.review_login(1);
select lives_ok($$select pg_temp.review_create(1)$$,'creator records an invitation through the original RPC');
select lives_ok($$select pg_temp.review_create(2)$$,'second invitation is independently recorded');

select pg_temp.review_login(2);
select is((select count(*) from public.expenses),2::bigint,'recipient can read their pending Direct invitations');
select is((select count(*) from public.expense_participations),4::bigint,'recipient sees the actual participants');
select is((select count(*) from public.expense_shares),4::bigint,'recipient can inspect every original share');
select is((select count(*) from public.payer_contributions),2::bigint,'recipient can inspect original payers');
select is((select count(*) from public.expense_participations where participant_id=public.current_participant_id() and state='pending'),
  2::bigint,'read visibility does not confirm pending shares');
select is((public.get_direct_outstanding('95000000-0000-4000-8000-000000000001','MYR')->>'signed_outstanding_minor')::bigint,
  0::bigint,'pending shares remain outside the confirmed net balance');

select pg_temp.review_login(3);
select is((select count(*) from public.expenses),0::bigint,'outsider cannot read pending expenses');
select is((select count(*) from public.expense_participations),0::bigint,'outsider cannot read participations');
select is((select count(*) from public.expense_shares),0::bigint,'outsider cannot read shares');
select is((select count(*) from public.payer_contributions),0::bigint,'outsider cannot read payers');
select is((select count(*) from public.financial_events where expense_id is not null),0::bigint,'outsider cannot read expense audit events');

select pg_temp.review_login(2);
select lives_ok($$select public.respond_to_direct_expense(pg_temp.review_id(1),'accepted',1)$$,
  'recipient confirms using the existing versioned RPC');
select is((public.get_direct_outstanding('95000000-0000-4000-8000-000000000001','MYR')->>'signed_outstanding_minor')::bigint,
  500::bigint,'only the accepted share enters the confirmed balance');
select lives_ok($$select public.respond_to_direct_expense(pg_temp.review_id(2),'declined',1)$$,
  'recipient can decline the other invitation through the existing RPC');
select is((select count(*) from public.expenses),1::bigint,'accepted history remains readable and declined visibility stays restricted');
select is((public.get_direct_outstanding('95000000-0000-4000-8000-000000000001','MYR')->>'signed_outstanding_minor')::bigint,
  500::bigint,'declining does not change the accepted balance');
select pg_temp.review_login(1);
select is((select count(*) from public.expenses),2::bigint,'creator retains both original immutable records');

select * from finish();
rollback;
