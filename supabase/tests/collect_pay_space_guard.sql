-- Run against a disposable local Supabase database after all migrations.
-- Real RPC/journal tests. Transaction rolls back all fixtures.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000001','authenticated','authenticated','cp-guard-1@example.test','',now(),
 '{"provider":"email","providers":["email"]}','{"display_name":"Guard 1"}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000002','authenticated','authenticated','cp-guard-2@example.test','',now(),
 '{"provider":"email","providers":["email"]}','{"display_name":"Guard 2"}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000003','authenticated','authenticated','cp-guard-3@example.test','',now(),
 '{"provider":"email","providers":["email"]}','{"display_name":"Guard 3"}',now(),now());
update public.participants set id = case auth_user_id
when '91000000-0000-4000-8000-000000000001'::uuid then '92000000-0000-4000-8000-000000000001'::uuid
when '91000000-0000-4000-8000-000000000002'::uuid then '92000000-0000-4000-8000-000000000002'::uuid
when '91000000-0000-4000-8000-000000000003'::uuid then '92000000-0000-4000-8000-000000000003'::uuid
end where auth_user_id in ('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000003');
insert into public.spaces(id,type,name,owner_participant_id,default_currency)
 values ('91000000-0000-4000-8000-000000000010','trip','CollectPay guard fixture','92000000-0000-4000-8000-000000000001','MYR');
insert into public.space_members(space_id,participant_id,role) values
 ('91000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001','owner'),('91000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000002','full_access');
create function pg_temp.cp_login(n integer) returns text language sql as $$
 select pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object(
 'role','authenticated','sub',('91000000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0')),
 'is_anonymous',false)::text,true);
$$;
create function pg_temp.cp_propose(n integer, amount bigint, expected bigint) returns uuid language sql as $$
 select public.propose_settlement(('93000000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid,
 'space','91000000-0000-4000-8000-000000000010','MYR',amount,'2026-10-09',array['92000000-0000-4000-8000-000000000002'::uuid],
 array[amount],null,null,expected,null,null,null);
$$;
create function pg_temp.cp_allocation(n integer) returns uuid language sql as $$
 select allocation.id from public.settlement_allocations as allocation
 join public.settlement_payments as payment on payment.id=allocation.settlement_payment_id
 where payment.client_request_id=('93000000-0000-4000-8000-' || pg_catalog.lpad(n::text,12,'0'))::uuid;
$$;
select is(has_function_privilege('authenticated',
 'private.space_signed_outstanding(uuid,uuid,uuid,text)','EXECUTE'),false,'internal authority is not callable by clients');
select is(has_function_privilege('authenticated',
 'public.phase6_propose_settlement_without_space_guard(uuid,text,uuid,text,bigint,date,uuid[],bigint[],text,text,bigint,uuid[],bigint[],uuid)',
 'EXECUTE'),false,'clients cannot bypass proposal guard');
select is(has_function_privilege('authenticated',
 'public.phase6_respond_to_settlement_without_space_guard(uuid,text,integer)',
 'EXECUTE'),false,'clients cannot bypass confirmation guard');
set local role authenticated;
select pg_temp.cp_login(1);
select lives_ok($$ select public.create_expense(
 '93000000-0000-4000-8000-000000000001','space','91000000-0000-4000-8000-000000000010',4800,'MYR','48 group debt','Other','2026-10-08',
 array['92000000-0000-4000-8000-000000000001'::uuid,'92000000-0000-4000-8000-000000000002'::uuid],array[0::bigint,4800::bigint],array[4800::bigint,0::bigint])
 $$,'real space expense establishes pair net 48');
select lives_ok($$ select public.create_expense(
 '93000000-0000-4000-8000-000000000002','space','91000000-0000-4000-8000-000000000010',700,'USD','Currency separation','Other','2026-10-08',
 array['92000000-0000-4000-8000-000000000001'::uuid,'92000000-0000-4000-8000-000000000002'::uuid],array[0::bigint,700::bigint],array[700::bigint,0::bigint])
 $$,'other currency is a separate balance');
reset role;
select is(private.space_signed_outstanding('91000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','MYR'),4800::bigint,'server pairing agrees with existing engine');
set local role authenticated;
reset role;
select is(private.space_signed_outstanding('91000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','USD'),700::bigint,'USD is not added to MYR');
set local role authenticated;
select throws_ok($$select pg_temp.cp_propose(10,2000,4700)$$,'P0001','balance_changed','stale expected net rejected before insert');
select throws_ok($$select pg_temp.cp_propose(11,4900,4800)$$,'P0001','amount_exceeds_outstanding_balance','space overpayment is not clamped');
select lives_ok($$select pg_temp.cp_propose(12,2000,4800)$$,'partial 20 uses real same-scope net');
select lives_ok($$select pg_temp.cp_propose(13,4800,4800)$$,'second pending proposal does not reserve confirmed balance');
select is((select count(*) from public.settlement_payments where client_request_id in ('93000000-0000-4000-8000-000000000010','93000000-0000-4000-8000-000000000011')),0::bigint,'rejected proposals leave no records');
reset role;
select is(private.space_signed_outstanding('91000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','MYR'),4800::bigint,'pending proposals leave confirmed 48');
set local role authenticated;
select lives_ok($$ select public.create_personal_account('93000000-0000-4000-8000-000000000003','Guard payer','bank','MYR',10000,'2026-01-01',true) $$,'payer chooses own real wallet');
select lives_ok($$select public.authorize_personal_settlement_cash_leg(
 '93000000-0000-4000-8000-000000000032',pg_temp.cp_allocation(12),'payer',
 (select id from public.personal_accounts where name='Guard payer'),2000)$$,'payer authorization 12');
select lives_ok($$select public.authorize_personal_settlement_cash_leg(
 '93000000-0000-4000-8000-000000000033',pg_temp.cp_allocation(13),'payer',
 (select id from public.personal_accounts where name='Guard payer'),4800)$$,'payer authorization 13');
select pg_temp.cp_login(2);
select lives_ok($$ select public.create_personal_account('93000000-0000-4000-8000-000000000004','Guard receiver','bank','MYR',0,'2026-01-01',true) $$,'receiver creates own wallet');
select lives_ok($$select public.authorize_personal_settlement_cash_leg(
 '93000000-0000-4000-8000-000000000052',pg_temp.cp_allocation(12),'receiver',
 (select id from public.personal_accounts where name='Guard receiver'),null)$$,'receiver authorization 12');
select lives_ok($$select public.authorize_personal_settlement_cash_leg(
 '93000000-0000-4000-8000-000000000053',pg_temp.cp_allocation(13),'receiver',
 (select id from public.personal_accounts where name='Guard receiver'),null)$$,'receiver authorization 13');
select lives_ok($$select public.respond_to_settlement(pg_temp.cp_allocation(12),'accepted',1)$$,'real confirmation posts partial 20');
reset role;
select is(private.space_signed_outstanding('91000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','MYR'),2800::bigint,'confirmed partial 20 leaves 28');
set local role authenticated;
select throws_ok($$select public.respond_to_settlement(pg_temp.cp_allocation(13),'accepted',1)$$,'P0001','balance_changed','second pending 48 cannot overpay now-28 net');
select is((select state from public.settlement_allocations where id=pg_temp.cp_allocation(13)),'pending','rejected confirmation preserves allocation');
select is((select status from public.personal_settlement_cash_legs where settlement_allocation_id=pg_temp.cp_allocation(13) and role='receiver'),'pending','rejected confirmation does not post cash');
select pg_temp.cp_login(1);
select lives_ok($$select pg_temp.cp_propose(12,2000,4800)$$,'same immutable proposal retry works after net changes');
select is((select count(*) from public.settlement_payments where client_request_id='93000000-0000-4000-8000-000000000012'),1::bigint,'retry did not duplicate payment');
select throws_ok($$select pg_temp.cp_propose(12,2100,4800)$$,'P0001','idempotency_conflict','changed retry payload is rejected');
select throws_ok($$select pg_temp.cp_propose(14,2800,4800)$$,'P0001','balance_changed','old preview cannot create a new payment');
select lives_ok($$select pg_temp.cp_propose(15,2800,2800)$$,'fresh full remaining 28 proposal');
select lives_ok($$select public.authorize_personal_settlement_cash_leg('93000000-0000-4000-8000-000000000035',pg_temp.cp_allocation(15),'payer',
 (select id from public.personal_accounts where name='Guard payer'),2800)$$,'payer binds remaining 28');
select pg_temp.cp_login(2);
select lives_ok($$select public.authorize_personal_settlement_cash_leg('93000000-0000-4000-8000-000000000055',pg_temp.cp_allocation(15),'receiver',
 (select id from public.personal_accounts where name='Guard receiver'),null)$$,'receiver binds remaining 28');
select lives_ok($$select public.respond_to_settlement(pg_temp.cp_allocation(15),'accepted',1)$$,'full remaining confirmation uses same existing journal transaction');
reset role;
select is(private.space_signed_outstanding('91000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','MYR'),0::bigint,'full confirmed amount leaves zero');
set local role authenticated;
select pg_temp.cp_login(2);
select lives_ok($$select public.reverse_settlement_allocation('93000000-0000-4000-8000-000000000080',pg_temp.cp_allocation(12),2,'Correction')$$,'existing immutable correction chain remains available');
reset role;
select is(private.space_signed_outstanding('91000000-0000-4000-8000-000000000010','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','MYR'),2000::bigint,'reversal restores original 20 debt');
set local role authenticated;
select pg_temp.cp_login(3);
select throws_ok($$select pg_temp.cp_propose(90,100,2000)$$,'P0001','space_membership_required','nonmember cannot acquire guarded proposal');
reset role;
insert into public.spaces(id,type,name,owner_participant_id,default_currency)
 values ('91000000-0000-4000-8000-000000000011','group','Three participant pairing','92000000-0000-4000-8000-000000000001','MYR');
insert into public.space_members(space_id,participant_id,role) values
 ('91000000-0000-4000-8000-000000000011','92000000-0000-4000-8000-000000000001','owner'),('91000000-0000-4000-8000-000000000011','92000000-0000-4000-8000-000000000002','full_access'),('91000000-0000-4000-8000-000000000011','92000000-0000-4000-8000-000000000003','full_access');
set local role authenticated;
select pg_temp.cp_login(1);
select lives_ok($$select public.create_expense('93000000-0000-4000-8000-000000000091',
 'space','91000000-0000-4000-8000-000000000011',4800,'MYR','Ordered pairing','Other','2026-10-08',
 array['92000000-0000-4000-8000-000000000001'::uuid,'92000000-0000-4000-8000-000000000002'::uuid,'92000000-0000-4000-8000-000000000003'::uuid],
 array[0::bigint,2000::bigint,2800::bigint],array[4800::bigint,0::bigint,0::bigint])$$,'three participants use existing ordered pairs');
select lives_ok($$select public.create_expense('93000000-0000-4000-8000-000000000092',
 'space','91000000-0000-4000-8000-000000000011',500,'MYR','Opposing expense','Other','2026-10-08',
 array['92000000-0000-4000-8000-000000000001'::uuid,'92000000-0000-4000-8000-000000000002'::uuid],array[500::bigint,0::bigint],array[0::bigint,500::bigint])$$,'opposing source offsets within pair only');
reset role;
select is(private.space_signed_outstanding('91000000-0000-4000-8000-000000000011','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000002','MYR'),1500::bigint,'first pair is 20 less 5, not whole group 43');
select is(private.space_signed_outstanding('91000000-0000-4000-8000-000000000011','92000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','MYR'),-1500::bigint,'pair direction has opposite signed net');
select is(private.space_signed_outstanding('91000000-0000-4000-8000-000000000011','92000000-0000-4000-8000-000000000001','92000000-0000-4000-8000-000000000003','MYR'),2800::bigint,'third participant net stays 28');
set local role authenticated;
select pg_temp.cp_login(1);
select throws_ok($$select public.propose_settlement('93000000-0000-4000-8000-000000000093',
 'space','91000000-0000-4000-8000-000000000011','MYR',4300,'2026-10-09',array['92000000-0000-4000-8000-000000000002'::uuid,'92000000-0000-4000-8000-000000000003'::uuid],
 array[1600::bigint,2700::bigint],null,null,4300,null,null,null)$$,'P0001',
 'amount_exceeds_outstanding_balance','same total cannot overpay one immutable pair');
select lives_ok($$select public.propose_settlement('93000000-0000-4000-8000-000000000094',
 'space','91000000-0000-4000-8000-000000000011','MYR',4300,'2026-10-09',array['92000000-0000-4000-8000-000000000002'::uuid,'92000000-0000-4000-8000-000000000003'::uuid],
 array[1500::bigint,2800::bigint],null,null,4300,null,null,null)$$,'existing multi-creditor rich capability is retained');
select lives_ok($$select public.propose_settlement('93000000-0000-4000-8000-000000000095',
 'space','91000000-0000-4000-8000-000000000010','MYR',2500,'2026-10-09',
 array['92000000-0000-4000-8000-000000000002'::uuid],array[2500::bigint],null)$$,
 'legacy nine-argument space proposals retain existing service rules');
select lives_ok($$select public.propose_settlement('93000000-0000-4000-8000-000000000096',
 'space','91000000-0000-4000-8000-000000000010','MYR',2500,'2026-10-09',
 array['92000000-0000-4000-8000-000000000002'::uuid],array[2500::bigint],null,null,null,null,null,null)$$,
 'rich legacy space clients without an expectation retain existing rules');
reset role;
select * from finish();
rollback;

