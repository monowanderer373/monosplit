begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','d0160000-0000-4000-8000-000000000001','authenticated','authenticated','mc-owner@example.test','',now(),'{"provider":"email","providers":["email"]}','{"display_name":"MC Owner"}',now(),now()),
('00000000-0000-0000-0000-000000000000','d0160000-0000-4000-8000-000000000002','authenticated','authenticated','mc-other@example.test','',now(),'{"provider":"email","providers":["email"]}','{"display_name":"MC Other"}',now(),now());
insert into public.friendships(participant_low_id,participant_high_id,requested_by,status,accepted_at)
select least(a.id,b.id),greatest(a.id,b.id),a.id,'accepted',now() from public.participants a,public.participants b
where a.auth_user_id='d0160000-0000-4000-8000-000000000001' and b.auth_user_id='d0160000-0000-4000-8000-000000000002';
create temp table mc(k text primary key,v jsonb);
grant all on table mc to authenticated;
create function pg_temp.mc_id(k text) returns uuid language sql as $$ select (v->>'account_id')::uuid from mc where mc.k=$1 $$;
create function pg_temp.mc_unit(k text) returns jsonb language sql as $$ select a from jsonb_array_elements(public.get_personal_multicurrency_accounts()->'accounts') a where (a->>'id')::uuid=pg_temp.mc_id($1) $$;
create function pg_temp.mc_balance(k text) returns bigint language sql as $$ select (pg_temp.mc_unit($1)->>'entry_sum_minor')::bigint $$;
-- New synthetic charges default explicitly to not included; special cases pass true/null.
create function pg_temp.mc_legs(k text,amount bigint,covered boolean default false) returns jsonb language sql as $$
 select jsonb_build_array(jsonb_build_object('account_id',u->>'id','version',(u->>'version')::integer,'parent_version',(u->>'parent_version')::integer,'amount_minor',$2,
 'anchor_id',a.id,'included_in_anchor',case when a.id is null then null else $3 end))
 from (select pg_temp.mc_unit($1) u) q left join lateral(select id from public.personal_account_balance_anchors where account_id=pg_temp.mc_id($1) order by anchor_sequence desc limit 1)a on true $$;

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

select ok(not has_function_privilege('authenticated','private.money_observed_on(uuid,timestamptz)','EXECUTE'),'private observed-date helper is not a public authority bypass');
insert into mc values('zoned-anchor',public.set_personal_currency_balance(gen_random_uuid(),pg_temp.mc_id('cash'),11000,'2026-10-15T17:00:00Z',
 (pg_temp.mc_unit('cash')->>'version')::integer,(pg_temp.mc_unit('cash')->>'parent_version')::integer,array(select id from personal_account_entries where account_id=pg_temp.mc_id('cash'))));
select is((select occurred_on from personal_account_transactions where id=(select(v->>'transaction_id')::uuid from mc where k='zoned-anchor')),'2026-10-16'::date,'observed balance journal keeps the account local day across UTC midnight');

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

-- Native movement command; the amounts below are observed test facts, no FX rate.
create function pg_temp.mc_coverage(k text) returns jsonb language sql as $$ select jsonb_build_object('anchor_id',a.id,'included_in_anchor',case when a.id is null then null else false end) from (select 1)q left join lateral(select id from public.personal_account_balance_anchors where account_id=pg_temp.mc_id($1) order by anchor_sequence desc limit 1)a on true $$;
create function pg_temp.mc_move(kind text,source text,target text,total_out bigint,net_in bigint,mode text default null,fee_source text default null,fee_minor bigint default null) returns jsonb language sql as $$
select jsonb_build_object('kind',$1,'source_account_id',a->>'id','source_version',(a->>'version')::integer,'source_parent_version',(a->>'parent_version')::integer,'source_total_minor',$4,'source_coverage',pg_temp.mc_coverage($2),
 'destination_account_id',b->>'id','destination_version',(b->>'version')::integer,'destination_parent_version',(b->>'parent_version')::integer,'destination_net_minor',$5,'destination_coverage',pg_temp.mc_coverage($3),'occurred_on',current_date,'memo','Synthetic actual movement',
 'fee',case when $6 is null then null else jsonb_build_object('mode',$6,'account_id',f->>'id','version',(f->>'version')::integer,'parent_version',(f->>'parent_version')::integer,'currency',f->>'currency','amount_minor',$8,'coverage',pg_temp.mc_coverage($7))end)
 from(select pg_temp.mc_unit($2)a,pg_temp.mc_unit($3)b,case when $7 is null then null else pg_temp.mc_unit($7)end f)q $$;
select ok(not has_function_privilege('anon','public.record_personal_money_movement(uuid,jsonb)','EXECUTE'),'anonymous cannot record movements');
select ok(not has_table_privilege('authenticated','public.personal_money_movement_fees','INSERT,UPDATE,DELETE'),'normal client cannot fabricate fee classification');
insert into mc values('exchange-before',jsonb_build_object('cash',pg_temp.mc_balance('cash'),'vnd',pg_temp.mc_balance('vnd'),'expenses',(select count(*)from expenses)));
insert into mc values('exchange',public.record_personal_money_movement(gen_random_uuid(),pg_temp.mc_move('exchange','cash','vnd',10000,600000)));
select is(pg_temp.mc_balance('cash'),(select(v->>'cash')::bigint-10000 from mc where k='exchange-before'),'same-account exchange posts actual native source');
select is(pg_temp.mc_balance('vnd'),(select(v->>'vnd')::bigint+600000 from mc where k='exchange-before'),'same-account exchange posts actual native destination');
select is((select count(*)from expenses),(select(v->>'expenses')::bigint from mc where k='exchange-before'),'exchange principal creates no consumption expense');
insert into mc values('transfer-before',to_jsonb(pg_temp.mc_balance('cash')+pg_temp.mc_balance('wise')));
insert into mc values('same-transfer',public.record_personal_money_movement(gen_random_uuid(),pg_temp.mc_move('transfer','wise','cash',1000,1000)));
select is(pg_temp.mc_balance('cash')+pg_temp.mc_balance('wise'),(select(v#>>'{}')::bigint from mc where k='transfer-before'),'same-currency transfer conserves native holdings');
select is((select v->>'kind'from mc where k='same-transfer'),'withdrawal','transfer to own Cash uses actual withdrawal semantics');
select throws_ok(format('select record_personal_money_movement(gen_random_uuid(),%L::jsonb)',pg_temp.mc_move('transfer','wise','cash',1000,900)::text),'P0001','same_currency_transfer_mismatch','same currency cannot silently lose money without a known fee');
insert into mc values('fee-before',jsonb_build_object('wise',pg_temp.mc_balance('wise'),'vnd',pg_temp.mc_balance('vnd')));
insert into mc values('fee-request',to_jsonb(gen_random_uuid())),('fee-payload',pg_temp.mc_move('withdrawal','wise','vnd',15000,900000,'included_source','wise',200));
insert into mc values('included-fee',public.record_personal_money_movement((select(v#>>'{}')::uuid from mc where k='fee-request'),(select v from mc where k='fee-payload')));
select is(pg_temp.mc_balance('wise'),(select(v->>'wise')::bigint-15000 from mc where k='fee-before'),'C29 source total150 includingfee2 deducts150, not152');
select is(pg_temp.mc_balance('vnd'),(select(v->>'vnd')::bigint+900000 from mc where k='fee-before'),'C29 actual received900000 is unchanged');
select is((select total_minor from expenses where id=(select(v->>'fee_expense_id')::uuid from mc where k='included-fee')),200::bigint,'known fee2 appears once as the existing canonical expense');
select is(public.record_personal_money_movement((select(v#>>'{}')::uuid from mc where k='fee-request'),(select v from mc where k='fee-payload')),(select v from mc where k='included-fee'),'entire movement and fee replay one authoritative result');
select is(pg_temp.mc_balance('wise'),(select(v->>'wise')::bigint-15000 from mc where k='fee-before'),'movement replay cannot deduct fee twice');
select throws_ok(format('select record_personal_money_movement(gen_random_uuid(),%L::jsonb)',pg_temp.mc_move('withdrawal','wise','vnd',15000,900000,'included_source','wise',16000)::text),'P0001','fee_exceeds_principal','fee beyond stated included source total is rejected');

insert into mc values('later-movement',public.record_personal_money_movement(gen_random_uuid(),pg_temp.mc_move('withdrawal','wise','vnd',5000,300000)));
select is((select count(*)from personal_money_movement_fees where movement_id=(select(v->>'movement_id')::uuid from mc where k='later-movement')),0::bigint,'unitemised fee is not a manufactured zero fee expense');
insert into mc values('late-fee-before',jsonb_build_object('wise',pg_temp.mc_balance('wise'),'vnd',pg_temp.mc_balance('vnd')));
insert into mc values('late-fee',public.itemise_personal_movement_fee(gen_random_uuid(),(select(v->>'movement_id')::uuid from mc where k='later-movement'),1,'included_source',100));
select is(pg_temp.mc_balance('wise'),(select(v->>'wise')::bigint from mc where k='late-fee-before'),'C33 later fee classification takes no second source debit');
select is(pg_temp.mc_balance('vnd'),(select(v->>'vnd')::bigint from mc where k='late-fee-before'),'later classification takes no destination debit');
select is((select total_minor from expenses where id=(select(v->>'fee_expense_id')::uuid from mc where k='late-fee')),100::bigint,'later known fee is one canonical cost');
select throws_ok(format('select link_expense_funding(gen_random_uuid(),%L,%L,100)',(select v->>'fee_expense_id'from mc where k='late-fee'),pg_temp.mc_id('wise')),'P0001','movement_fee_already_funded','old funding linker cannot debit an already observed later-classified fee');
select is(pg_temp.mc_balance('wise'),(select(v->>'wise')::bigint from mc where k='late-fee-before'),'blocked late fee debit leaves native balance unchanged');

insert into mc values('separate-before',jsonb_build_object('wise',pg_temp.mc_balance('wise'),'jpy',pg_temp.mc_balance('jpy')));
insert into mc values('separate-fee',public.record_personal_money_movement(gen_random_uuid(),pg_temp.mc_move('withdrawal','wise','vnd',2000,120000,'separate','jpy',10)));
select is(pg_temp.mc_balance('wise'),(select(v->>'wise')::bigint-2000 from mc where k='separate-before'),'separate JPY charge is not numerically added to MYR');
select is(pg_temp.mc_balance('jpy'),(select(v->>'jpy')::bigint-10 from mc where k='separate-before'),'separate actual fee posts its own pocket exactly once');
insert into mc values('target-before',to_jsonb(pg_temp.mc_balance('vnd')));
insert into mc values('target-fee',public.record_personal_money_movement(gen_random_uuid(),pg_temp.mc_move('withdrawal','wise','vnd',1000,60000,'included_destination','vnd',2000)));
select is(pg_temp.mc_balance('vnd'),(select(v#>>'{}')::bigint+60000 from mc where k='target-before'),'target included fee leaves exactly the observed net receipt');
select is((select total_minor from expenses where id=(select(v->>'fee_expense_id')::uuid from mc where k='target-fee')),2000::bigint,'target fee classification uses target units without cross-currency subtraction');
select lives_ok(format('select create_refund_transaction(gen_random_uuid(),%L,50,current_date,null,%L)',pg_temp.mc_id('vnd'),'Actual native refund'),'existing refund consumer accepts the real additional currency account ID');

insert into mc values('reverse-before',jsonb_build_object('wise',pg_temp.mc_balance('wise'),'vnd',pg_temp.mc_balance('vnd')));
select throws_ok(format('select reverse_personal_account_transaction(gen_random_uuid(),%L,current_date,%L)',(select v->>'transaction_id'from mc where k='included-fee'),'Partial movement reversal'),'P0001','money_movement_reversal_required','legacy principal-only reversal cannot strand a movement fee');
select lives_ok(format('select reverse_personal_money_movement(gen_random_uuid(),%L,1,current_date,%L)',(select v->>'movement_id'from mc where k='included-fee'),'Actual recorded reversal'),'movement principal and actual fee reverse in one transaction');
select is(pg_temp.mc_balance('wise'),(select(v->>'wise')::bigint+15000 from mc where k='reverse-before'),'included fee reversal refunds total150 once, not152');
select is(pg_temp.mc_balance('vnd'),(select(v->>'vnd')::bigint-900000 from mc where k='reverse-before'),'movement reversal compensates the exact destination');
select is((select status from expenses where id=(select(v->>'fee_expense_id')::uuid from mc where k='included-fee')),'voided','fee cancellation uses original canonical cancellation authority');

-- Separate actual fee from the same unit has its own observed-balance coverage.
insert into mc values('mixed-coverage-before',to_jsonb(pg_temp.mc_balance('wise')));
insert into mc values('mixed-coverage',public.record_personal_money_movement(gen_random_uuid(),jsonb_set(pg_temp.mc_move('withdrawal','wise','vnd',1000,60000,'separate','wise',200),'{source_coverage,included_in_anchor}','true'::jsonb)));
select is(pg_temp.mc_balance('wise'),(select(v#>>'{}')::bigint-200 from mc where k='mixed-coverage-before'),'already included principal does not hide a separate unreflected same-unit fee');
select is((select count(*) from personal_money_movement_coverage where movement_id=(select(v->>'movement_id')::uuid from mc where k='mixed-coverage') and account_id=pg_temp.mc_id('wise')),2::bigint,'principal and separate same-unit fee retain distinct coverage facts');
select is((select count(*) from personal_money_movement_coverage where movement_id=(select(v->>'movement_id')::uuid from mc where k='mixed-coverage') and account_id=pg_temp.mc_id('wise') and included_in_anchor and calibration_transaction_id is not null),1::bigint,'only the included principal is calibrated; actual fee remains debited once');

-- A known balance entered while adding a currency is also an observed anchor.
insert into mc values('new-currency-pending',public.create_expense_with_multicurrency_funding(gen_random_uuid(),pg_temp.mc_expense(2000,'EUR','Pending before currency exists'),jsonb_build_object('mode','deferred','primary_account_id',pg_temp.mc_id('wise'),'legs','[]'::jsonb)));
insert into mc values('eur',public.add_personal_account_currency(gen_random_uuid(),pg_temp.mc_id('wise'),'EUR',(pg_temp.mc_unit('wise')->>'version')::integer,10000,current_date));
select is((select count(*) from personal_account_balance_anchors where account_id=pg_temp.mc_id('eur')),1::bigint,'new known currency opening captures observed balance coverage without a second journal');
select throws_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,1,1,%L::jsonb,true)',(select v->'funding'->>'funding_intent_id'from mc where k='new-currency-pending'),pg_temp.mc_legs('eur',2000,null)),'P0001','balance_coverage_required','unknown source becoming a new known currency must be reviewed explicitly');
select lives_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,1,1,%L::jsonb,true)',(select v->'funding'->>'funding_intent_id'from mc where k='new-currency-pending'),pg_temp.mc_legs('eur',2000,true)),'new currency known balance can include the earlier actual deduction');
select is(pg_temp.mc_balance('eur'),10000::bigint,'new currency observed100 including old20 remains100, not80');

-- Unposted legacy source candidates can be upgraded only by an explicit versioned review.
insert into mc values('legacy-pending-expense',to_jsonb(public.create_expense(gen_random_uuid(),'personal',null,90000,'VND','Legacy pending source review','Food',current_date,array[current_participant_id()],array[90000::bigint],array[90000::bigint])));
insert into mc values('legacy-pending',public.link_expense_funding(gen_random_uuid(),(select(v#>>'{}')::uuid from mc where k='legacy-pending-expense'),pg_temp.mc_id('wise'),null));
select throws_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,1,1,%L::jsonb,true)',(select v->>'funding_intent_id'from mc where k='legacy-pending'),pg_temp.mc_legs('vnd',90000,false)),'P0001','funding_account_changed','legacy source candidate cannot silently change before explicit review');
select lives_ok(format('select review_changed_personal_funding(gen_random_uuid(),%L,1,1)',(select v->>'funding_intent_id'from mc where k='legacy-pending')),'owner explicitly upgrades the pending source candidate without a cash write');
select is((select count(*) from personal_account_transactions where expense_id=(select(v#>>'{}')::uuid from mc where k='legacy-pending-expense')),0::bigint,'legacy source review does not post money or recreate the expense');
select lives_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,2,1,%L::jsonb,true)',(select v->>'funding_intent_id'from mc where k='legacy-pending'),pg_temp.mc_legs('vnd',90000,false)),'explicitly reviewed legacy expense may use its actual owned currency source');
select is((select id from personal_funding_intents where expense_id=(select(v#>>'{}')::uuid from mc where k='legacy-pending-expense')),(select(v->>'funding_intent_id')::uuid from mc where k='legacy-pending'),'upgrading an unposted source preserves the historical intent UUID');

-- C16: bill, accepted owner payment and share are three different amounts.
insert into mc values('direct-body',jsonb_build_object('expense_scope','direct','target_space_id',null,'total_minor',9000,'currency_code','MYR',
 'description','Direct bill90 ownpayment60 share45','category','Food','occurred_on',current_date,
 'participant_ids',jsonb_build_array(current_participant_id(),(select id from participants where auth_user_id='d0160000-0000-4000-8000-000000000002')),
 'contribution_amounts',jsonb_build_array(6000,3000),'share_amounts',jsonb_build_array(4500,4500)));
insert into mc values('direct',public.create_expense_with_multicurrency_funding(gen_random_uuid(),(select v from mc where k='direct-body'),jsonb_build_object('mode','deferred','primary_account_id',pg_temp.mc_id('wise'),'legs','[]'::jsonb)));
select is((select expense_amount_minor from personal_funding_intents where id=(select(v->'funding'->>'funding_intent_id')::uuid from mc where k='direct')),6000::bigint,'C16 accepted own payment is60, neither bill90 nor share45');
select throws_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,1,1,%L::jsonb,true)',(select v->'funding'->>'funding_intent_id'from mc where k='direct'),pg_temp.mc_legs('wise',4500,false)),'P0001','funding_contribution_mismatch','C16 share45 cannot substitute for actual ownpayment60');
select throws_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,1,1,%L::jsonb,true)',(select v->'funding'->>'funding_intent_id'from mc where k='direct'),pg_temp.mc_legs('wise',9000,false)),'P0001','funding_contribution_mismatch','C16 bill90 cannot substitute for actual ownpayment60');
insert into mc values('direct-before',to_jsonb(pg_temp.mc_balance('wise')));
select lives_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,1,1,%L::jsonb,true)',(select v->'funding'->>'funding_intent_id'from mc where k='direct'),pg_temp.mc_legs('wise',6000,false)),'C16 own accepted payment60 confirms');
select is(pg_temp.mc_balance('wise'),(select(v#>>'{}')::bigint-6000 from mc where k='direct-before'),'C16 only60 is debited once');
select is((select state from expense_participations where expense_id=(select(v->>'expense_id')::uuid from mc where k='direct') and participant_id<>current_participant_id()),'pending','C16 private funding does not accept another participant or expand shared authority');

-- A newly created backdated charge was not in the anchor's pending-ID cutoff.
-- Its actual source still needs explicit coverage, never an inferred date rule.
insert into mc values('backdated-before',jsonb_build_object('balance',pg_temp.mc_balance('wise')));
insert into mc values('backdated-new',create_expense_with_multicurrency_funding(gen_random_uuid(),pg_temp.mc_expense(1620,'MYR','Backdated actual source after observed balance')||jsonb_build_object('occurred_on',current_date-7),jsonb_build_object('mode','deferred','primary_account_id',pg_temp.mc_id('wise'),'legs','[]'::jsonb)));
select throws_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,1,1,%L::jsonb,true)',(select v->'funding'->>'funding_intent_id'from mc where k='backdated-new'),pg_temp.mc_legs('wise',1620,null)),'P0001','balance_coverage_required','C37 newly created backdated charge still requires explicit native coverage');
select lives_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,1,1,%L::jsonb,true)',(select v->'funding'->>'funding_intent_id'from mc where k='backdated-new'),pg_temp.mc_legs('wise',1620,true)),'C37 owner may explicitly include a newly recorded old deduction');
select is(pg_temp.mc_balance('wise'),(select(v->>'balance')::bigint from mc where k='backdated-before'),'C37 explicit already included backdated charge preserves the observed stock');

-- Recovery after close/reload never guesses whether an earlier command committed.
insert into mc values('recovery-request',jsonb_build_object('request_id',gen_random_uuid(),'before',pg_temp.mc_balance('wise')));
select is(reconcile_personal_money_operation((select(v->>'request_id')::uuid from mc where k='recovery-request'))->>'state','not_posted','C47 unresolved absent request is fenced without a financial posting');
select is(reconcile_personal_money_operation((select(v->>'request_id')::uuid from mc where k='recovery-request'))->>'state','not_posted','C47 request fence is idempotent');
select throws_ok(format('select add_personal_account_currency(%L,%L,%L,%s,null,null)',(select v->>'request_id'from mc where k='recovery-request'),pg_temp.mc_id('wise'),'JPY',(pg_temp.mc_unit('wise')->>'version')::integer),'P0001','idempotency_conflict','C47 original delayed command cannot post after its absent request was retired');
select is(pg_temp.mc_balance('wise'),(select(v->>'before')::bigint from mc where k='recovery-request'),'C47 recovery fence preserves native balances');
select is((reconcile_personal_money_operation((select request_id from personal_money_operations where kind='add_currency' order by created_at,id limit 1))->'result'),(select result from personal_money_operations where kind='add_currency' order by created_at,id limit 1),'C47 committed receipt is returned intact, never retired or reversed');
select ok(not has_function_privilege('anon','public.reconcile_personal_money_operation(uuid)','EXECUTE'),'C47 recovery endpoint denies anon');
insert into mc values('owner-recovery-receipt',(select jsonb_build_object('request_id',request_id,'result',result)from personal_money_operations where kind='add_currency'order by created_at,id limit 1));
set local "request.jwt.claims"='{"role":"authenticated","sub":"d0160000-0000-4000-8000-000000000002","is_anonymous":false}';
select is(reconcile_personal_money_operation((select(v->>'request_id')::uuid from mc where k='owner-recovery-receipt'))->>'state','not_posted','C40 other owner cannot recover my committed receipt through its request UUID');
select is(get_personal_money_operation((select(v->>'request_id')::uuid from mc where k='owner-recovery-receipt'))->>'operation_not_posted','true','C40 other owner sees only its own new opaque request fence');
set local "request.jwt.claims"='{"role":"authenticated","sub":"d0160000-0000-4000-8000-000000000001","is_anonymous":false}';
select is(get_personal_money_operation((select(v->>'request_id')::uuid from mc where k='owner-recovery-receipt')),(select v->'result'from mc where k='owner-recovery-receipt'),'C40 other-owner request fence cannot retire or alter my receipt');


-- Archive after the actual-source form captured native versions.
insert into mc values('archive-inflight',create_expense_with_multicurrency_funding(gen_random_uuid(),pg_temp.mc_expense(1000,'EUR','Source archived on another device'),jsonb_build_object('mode','deferred','primary_account_id',pg_temp.mc_id('wise'),'legs','[]'::jsonb)));
insert into mc values('archive-legs',pg_temp.mc_legs('eur',1000,false)),('archive-balance',jsonb_build_object('amount',pg_temp.mc_balance('eur')));
select lives_ok(format('select archive_personal_account(gen_random_uuid(),%L,null,%s)',pg_temp.mc_id('wise'),(pg_temp.mc_unit('wise')->>'version')::integer),'C24 original parent archive remains available');
select ok((pg_temp.mc_unit('eur')->>'archived_at')is not null,'C24 parent archive propagates to its explicit native currency units');
select throws_ok(format('select confirm_personal_funding_bundle(gen_random_uuid(),%L,1,1,%L::jsonb,true)',(select v->'funding'->>'funding_intent_id'from mc where k='archive-inflight'),(select v from mc where k='archive-legs')),'P0001','personal_account_archived','C24 stale native source form cannot post after parent archive');
select is(pg_temp.mc_balance('eur'),(select(v->>'amount')::bigint from mc where k='archive-balance'),'C24 archive preserves native history and failed stale completion debits nothing');

set constraints all immediate;
select * from finish();
rollback;
