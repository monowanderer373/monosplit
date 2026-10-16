begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','d0160000-0000-4000-8000-000000000001','authenticated','authenticated','mc-owner@example.test','',now(),'{"provider":"email","providers":["email"]}','{"display_name":"MC Owner"}',now(),now()),
('00000000-0000-0000-0000-000000000000','d0160000-0000-4000-8000-000000000002','authenticated','authenticated','mc-other@example.test','',now(),'{"provider":"email","providers":["email"]}','{"display_name":"MC Other"}',now(),now());
create temp table mc(k text primary key,v jsonb);
grant all on table mc to authenticated;
create function pg_temp.mc_id(k text) returns uuid language sql as $$ select (v->>'account_id')::uuid from mc where mc.k=$1 $$;
create function pg_temp.mc_unit(k text) returns jsonb language sql as $$ select a from jsonb_array_elements(public.get_personal_multicurrency_accounts()->'accounts') a where (a->>'id')::uuid=pg_temp.mc_id($1) $$;
create function pg_temp.mc_balance(k text) returns bigint language sql as $$ select (pg_temp.mc_unit($1)->>'entry_sum_minor')::bigint $$;
create function pg_temp.mc_legs(k text,amount bigint,covered boolean default null) returns jsonb language sql as $$
 select jsonb_build_array(jsonb_build_object('account_id',u->>'id','version',(u->>'version')::integer,'parent_version',(u->>'parent_version')::integer,'amount_minor',$2,
 'anchor_id',(select id from public.personal_account_balance_anchors where account_id=pg_temp.mc_id($1) order by anchor_sequence desc limit 1),'included_in_anchor',$3))
 from (select pg_temp.mc_unit($1) u) q $$;
create function pg_temp.mc_expense(amount bigint,currency text,title text) returns jsonb language sql as $$
 select jsonb_build_object('expense_scope','personal','target_space_id',null,'total_minor',$1,'currency_code',$2,'description',$3,'category','Food','occurred_on',current_date,
 'participant_ids',jsonb_build_array(public.current_participant_id()),'contribution_amounts',jsonb_build_array($1),'share_amounts',jsonb_build_array($1)) $$;
create function pg_temp.mc_set(k text,amount bigint) returns jsonb language sql as $$
 select public.set_personal_currency_balance(gen_random_uuid(),pg_temp.mc_id($1),$2,now(),(u->>'version')::integer,(u->>'parent_version')::integer,
 array(select id from public.personal_account_entries where account_id=pg_temp.mc_id($1))) from (select pg_temp.mc_unit($1) u) q $$;

select is((select count(*) from pg_class where oid in('public.personal_account_currencies'::regclass,'public.personal_money_operations'::regclass,'public.personal_account_balance_anchors'::regclass,'public.personal_funding_bundles'::regclass,'public.personal_funding_bundle_legs'::regclass) and relrowsecurity),5::bigint,'new private relations enable RLS');
select ok(not has_table_privilege('authenticated','public.personal_funding_bundle_legs','INSERT,UPDATE,DELETE'),'clients cannot insert partial actual legs');
select ok(not has_function_privilege('anon','public.confirm_personal_funding_bundle(uuid,uuid,integer,integer,jsonb,boolean)','EXECUTE'),'anonymous cannot confirm bundles');
select ok(not has_function_privilege('authenticated','private.begin_money_operation(uuid,uuid,text,jsonb)','EXECUTE'),'clients cannot stage operation permits');
set local role authenticated;
set local "request.jwt.claims"='{"role":"authenticated","sub":"d0160000-0000-4000-8000-000000000001","is_anonymous":false}';
insert into mc values('cash',public.create_personal_account(gen_random_uuid(),'Cash','cash','MYR',null,null,true)),('wise',public.create_personal_account(gen_random_uuid(),'Wise','ewallet','MYR',200000,current_date,false));
select is((public.get_personal_multicurrency_accounts()->>'schema_version')::integer,1,'current capability is explicit');
select is((select count(*) from personal_accounts),2::bigint,'two original parents before adding a currency');
insert into mc values('vnd',public.add_personal_account_currency(gen_random_uuid(),pg_temp.mc_id('cash'),'VND',(pg_temp.mc_unit('cash')->>'version')::integer,1000000,current_date));
select is((select count(*) from personal_accounts),2::bigint,'old account enumeration never exposes child currency units');
select is(jsonb_array_length(public.get_personal_multicurrency_accounts()->'accounts'),3,'new owner enumeration sees all explicit native units');
select is(pg_temp.mc_balance('vnd'),1000000::bigint,'explicit native opening is not an FX estimate');
select is((select currency from personal_accounts where id=pg_temp.mc_id('cash')),'MYR','old default currency is unchanged');
select throws_ok(format('select public.add_personal_account_currency(gen_random_uuid(),%L,%L,%s,null,null)',pg_temp.mc_id('cash'),'VND',pg_temp.mc_unit('cash')->>'version'),'P0001','currency_already_exists','no duplicate currency unit');
insert into mc values('jpy',public.add_personal_account_currency(gen_random_uuid(),pg_temp.mc_id('cash'),'JPY',(pg_temp.mc_unit('cash')->>'version')::integer,0,current_date));
select is(pg_temp.mc_balance('jpy'),0::bigint,'explicit known zero remains zero');
select is(pg_temp.mc_unit('jpy')->>'opening_status','posted','known zero is not unknown');

-- Unknown absolute balance can retain an actual delta, followed by explicit coverage.
select public.create_expense_with_funding(gen_random_uuid(),'personal',null,2000,'MYR','Old paid item','Food',current_date,array[public.current_participant_id()],array[2000::bigint],array[2000::bigint],gen_random_uuid(),pg_temp.mc_id('cash'),2000);
select is(pg_temp.mc_unit('cash')->>'opening_status','unknown','a verified debit does not manufacture an absolute baseline');
select is(pg_temp.mc_balance('cash'),(-2000)::bigint,'unknown account still stores its native delta');
select lives_ok($$select pg_temp.mc_set('cash',10000)$$,'observed100 includes already recorded minus20');
select is(pg_temp.mc_balance('cash'),10000::bigint,'C34 observed100 is100, not80 or120');
select is((select count(*) from personal_account_entries e join personal_account_transactions t on t.id=e.transaction_id where e.account_id=pg_temp.mc_id('cash') and t.kind='expense_funding'),1::bigint,'late baseline does not replay the debit');

insert into mc values('defer-request',to_jsonb(gen_random_uuid()));
insert into mc values('defer-payload',jsonb_build_object('expense',pg_temp.mc_expense(90000,'VND','Deferred Food'),'funding',jsonb_build_object('mode','deferred','primary_account_id',pg_temp.mc_id('wise'),'legs','[]'::jsonb)));
insert into mc values('deferred',public.create_expense_with_multicurrency_funding((select(v#>>'{}')::uuid from mc where k='defer-request'),(select v->'expense'from mc where k='defer-payload'),(select v->'funding'from mc where k='defer-payload')));
select is((select v->'funding'->>'funding_status'from mc where k='deferred'),'pending','unknown actual currency and amount save the expense');
select is((select account_id from personal_funding_intents where id=(select(v->'funding'->>'funding_intent_id')::uuid from mc where k='deferred')),null::uuid,'intended Wise does not assert a MYR source');
select is((select primary_account_id from personal_funding_bundles where funding_intent_id=(select(v->'funding'->>'funding_intent_id')::uuid from mc where k='deferred')),pg_temp.mc_id('wise'),'primary account grouping is retained independently');
select is(pg_temp.mc_balance('wise'),200000::bigint,'deferred expense has zero estimated debit');
select is((select count(*) from personal_account_transactions where expense_id=(select(v->>'expense_id')::uuid from mc where k='deferred')),0::bigint,'no pending actual journal');
select throws_ok(format('select complete_pending_funding(gen_random_uuid(),%L,%L,1620)',(select v->'funding'->>'funding_intent_id'from mc where k='deferred'),pg_temp.mc_id('wise')),'P0001','funding_bundle_review_required','legacy endpoint cannot bypass managed actual-source review');
select is(pg_temp.mc_balance('wise'),200000::bigint,'legacy rejected completion rolls its earlier journal back');
select lives_ok($$select pg_temp.mc_set('wise',10000)$$,'set observed Wise100 and capture existing pending intent');
insert into mc values('confirm-request',to_jsonb(gen_random_uuid())),('confirm-legs',pg_temp.mc_legs('wise',1620,true));
insert into mc values('confirmed',public.confirm_personal_funding_bundle((select(v#>>'{}')::uuid from mc where k='confirm-request'),(select(v->'funding'->>'funding_intent_id')::uuid from mc where k='deferred'),1,1,(select v from mc where k='confirm-legs'),true));
select is(pg_temp.mc_balance('wise'),10000::bigint,'C35 already included16.20 leaves observed100');
select is((select total_minor from expenses where id=(select(v->>'expense_id')::uuid from mc where k='deferred')),90000::bigint,'original VND expense is untouched');
select is((select count(*) from personal_funding_bundle_legs where funding_intent_id=(select(v->'funding'->>'funding_intent_id')::uuid from mc where k='deferred')),1::bigint,'real debit exists exactly once');
select is(public.confirm_personal_funding_bundle((select(v#>>'{}')::uuid from mc where k='confirm-request'),(select(v->'funding'->>'funding_intent_id')::uuid from mc where k='deferred'),1,1,(select v from mc where k='confirm-legs'),true),(select v from mc where k='confirmed'),'same request replays despite advanced versions');
select is(pg_temp.mc_balance('wise'),10000::bigint,'replay does not debit or compensate again');
select throws_ok(format('select confirm_personal_funding_bundle(%L,%L,1,1,%L::jsonb,true)',(select v#>>'{}'from mc where k='confirm-request'),(select v->'funding'->>'funding_intent_id'from mc where k='deferred'),pg_temp.mc_legs('wise',1621,true)::text),'P0001','idempotency_conflict','changed replay payload is rejected');

insert into mc values('not-included',public.create_expense_with_multicurrency_funding(gen_random_uuid(),pg_temp.mc_expense(90000,'VND','Other old Food'),jsonb_build_object('mode','deferred','primary_account_id',pg_temp.mc_id('wise'),'legs','[]'::jsonb)));
select pg_temp.mc_set('wise',10000);
select public.confirm_personal_funding_bundle(gen_random_uuid(),(select(v->'funding'->>'funding_intent_id')::uuid from mc where k='not-included'),1,1,pg_temp.mc_legs('wise',1620,false),true);
select is(pg_temp.mc_balance('wise'),8380::bigint,'C36 not included16.20 leaves83.80');

insert into mc values('multi-before',jsonb_build_object('wise',pg_temp.mc_balance('wise'),'vnd',pg_temp.mc_balance('vnd')));
insert into mc values('multi-request',to_jsonb(gen_random_uuid()));
insert into mc values('multi-payload',jsonb_build_object('expense',pg_temp.mc_expense(90000,'VND','Split native sources'),'funding',jsonb_build_object('mode','actual','primary_account_id',pg_temp.mc_id('wise'),'covers_owner_payment',true,'legs',pg_temp.mc_legs('wise',1080,false)||pg_temp.mc_legs('vnd',30000))));
insert into mc values('multi',public.create_expense_with_multicurrency_funding((select(v#>>'{}')::uuid from mc where k='multi-request'),(select v->'expense'from mc where k='multi-payload'),(select v->'funding'from mc where k='multi-payload')));
select is((select count(*) from personal_funding_bundle_legs where funding_intent_id=(select(v->'funding'->>'funding_intent_id')::uuid from mc where k='multi')),2::bigint,'two real sources are posted as one owner funding bundle');
select is(pg_temp.mc_balance('wise'),(select(v->>'wise')::bigint-1080 from mc where k='multi-before'),'foreign actual MYR source debited once');
select is(pg_temp.mc_balance('vnd'),(select(v->>'vnd')::bigint-30000 from mc where k='multi-before'),'native VND source debited once');
select is((select amount_minor from payer_contributions where expense_id=(select(v->>'expense_id')::uuid from mc where k='multi')),90000::bigint,'mixed sources do not rewrite original paid contribution or sum mixed units');
select is(public.create_expense_with_multicurrency_funding((select(v#>>'{}')::uuid from mc where k='multi-request'),(select v->'expense'from mc where k='multi-payload'),(select v->'funding'from mc where k='multi-payload')),(select v from mc where k='multi'),'entire create/bundle operation is idempotent');

insert into mc values('rollback',public.create_expense_with_multicurrency_funding(gen_random_uuid(),pg_temp.mc_expense(90000,'VND','Invalid second source'),jsonb_build_object('mode','deferred','primary_account_id',pg_temp.mc_id('wise'),'legs','[]'::jsonb)));
insert into mc values('rollback-count',to_jsonb((select count(*) from personal_account_entries)));
select throws_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,1,1,%L::jsonb,true)',(select v->'funding'->>'funding_intent_id'from mc where k='rollback'),(pg_temp.mc_legs('vnd',90000)||jsonb_build_array(jsonb_build_object('account_id','d0160000-9999-4000-8000-000000000001','version',1,'parent_version',1,'amount_minor',100)))::text),'P0001','personal_account_not_found','invalid second unit rejects the whole bundle');
select is((select count(*) from personal_account_entries),(select(v#>>'{}')::bigint from mc where k='rollback-count'),'invalid second source never leaves a partial first debit');
select throws_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,1,1,%L::jsonb,true)',(select v->'funding'->>'funding_intent_id'from mc where k='rollback'),(pg_temp.mc_legs('vnd',45000)||pg_temp.mc_legs('vnd',45000))::text),'P0001','duplicate_funding_source','duplicate pocket rows cannot post twice');
select throws_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,99,1,%L::jsonb,true)',(select v->'funding'->>'funding_intent_id'from mc where k='rollback'),pg_temp.mc_legs('vnd',90000)::text),'P0001','version_conflict','stale intent cannot post');

set local "request.jwt.claims"='{"role":"authenticated","sub":"d0160000-0000-4000-8000-000000000002","is_anonymous":false}';
select is(jsonb_array_length(public.get_personal_multicurrency_accounts()->'accounts'),0,'other owner cannot enumerate currency units');
select is((select count(*) from personal_funding_bundles),0::bigint,'other owner cannot read funding bundles');
select is((select count(*) from personal_account_balance_anchors),0::bigint,'other owner cannot read balance coverage');
select throws_ok(format('select add_personal_account_currency(gen_random_uuid(),%L,%L,1,null,null)',pg_temp.mc_id('cash'),'EUR'),'P0001','personal_account_not_found','other owner cannot add a currency to my account');
select throws_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,1,1,%L::jsonb,true)',(select v->'funding'->>'funding_intent_id'from mc where k='rollback'),'[]'),'P0001','invalid_funding_bundle','malformed other-owner bundle is rejected');
set local "request.jwt.claims"='{"role":"authenticated","sub":"d0160000-0000-4000-8000-000000000001","is_anonymous":false}';
select is((select count(*) from personal_accounts where is_default),1::bigint,'currency addition never changes the one original global default');
select lives_ok($$select public.create_expense_with_funding(gen_random_uuid(),'personal',null,100,'MYR','Old client normal expense','Food',current_date,array[public.current_participant_id()],array[100::bigint],array[100::bigint],gen_random_uuid(),pg_temp.mc_id('cash'),null)$$,'retained old client original default-currency posting still works');
select throws_ok(format('select reverse_personal_account_transaction(gen_random_uuid(),%L,current_date,%L)',(select transaction_id from personal_funding_bundle_legs where funding_intent_id=(select(v->'funding'->>'funding_intent_id')::uuid from mc where k='multi') limit 1),'partial reversal'),'P0001','funding_bundle_reversal_required','legacy single-leg reversal cannot leave a partially reversed bundle');
select lives_ok(format('select reverse_personal_funding_bundle(gen_random_uuid(),%L,%s,current_date,%L)',(select v->'funding'->>'funding_intent_id'from mc where k='multi'),(select version from personal_funding_intents where id=(select(v->'funding'->>'funding_intent_id')::uuid from mc where k='multi')),'Actual payment reversal'),'all actual bundle legs reverse atomically');
select is(pg_temp.mc_balance('vnd'),(select(v->>'vnd')::bigint from mc where k='multi-before'),'bundle reversal restores native VND once');
select is(pg_temp.mc_balance('wise'),(select(v->>'wise')::bigint from mc where k='multi-before'),'bundle reversal restores native MYR once');
select is((select status from expenses where id=(select(v->>'expense_id')::uuid from mc where k='multi')),'active','private reversal does not cancel immutable shared expense authority');
set constraints all immediate;
select * from finish();
rollback;
