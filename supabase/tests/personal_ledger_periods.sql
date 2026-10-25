-- Disposable transactional tests. Never run a Fresh Start on production.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','d0250000-0000-4000-8000-000000000001','authenticated','authenticated','period-owner@example.test','',now(),'{"provider":"email","providers":["email"]}','{"display_name":"Period Owner"}',now(),now()),
('00000000-0000-0000-0000-000000000000','d0250000-0000-4000-8000-000000000002','authenticated','authenticated','period-other@example.test','',now(),'{"provider":"email","providers":["email"]}','{"display_name":"Period Other"}',now(),now());
insert into public.friendships(participant_low_id,participant_high_id,requested_by,status,accepted_at)
select least(a.id,b.id),greatest(a.id,b.id),a.id,'accepted',now() from public.participants a,public.participants b
where a.auth_user_id='d0250000-0000-4000-8000-000000000001'and b.auth_user_id='d0250000-0000-4000-8000-000000000002';
create temp table fresh(k text primary key,v jsonb);grant all on fresh to authenticated;
create function pg_temp.claims(who text,age int default 0,anonymous boolean default false)returns void language plpgsql as $$begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',$1,'role','authenticated','is_anonymous',$3,'iat',extract(epoch from now())::bigint,'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',extract(epoch from clock_timestamp())::bigint-$2)))::text,true);end $$;
create function pg_temp.unit(k text)returns jsonb language sql as $$select x from jsonb_array_elements(get_personal_multicurrency_accounts()->'accounts')x where x->>'id'=(select v->>'account_id'from fresh where fresh.k=$1)$$;
create function pg_temp.balance(k text)returns bigint language sql as $$select(pg_temp.unit($1)->>'entry_sum_minor')::bigint$$;
create function pg_temp.payload(amount bigint,currency text,title text)returns jsonb language sql as $$select jsonb_build_object('expense_scope','personal','total_minor',$1,'currency_code',$2,'description',$3,'category','Food','occurred_on',current_date,'participant_ids',jsonb_build_array(current_participant_id()),'contribution_amounts',jsonb_build_array($1),'share_amounts',jsonb_build_array($1))$$;
create function pg_temp.review()returns jsonb language plpgsql as $$declare p jsonb;begin p:=preview_personal_fresh_start();insert into fresh values('preview',p)on conflict(k)do update set v=excluded.v;return p;end$$;
create function pg_temp.openings()returns jsonb language sql as $$select coalesce(jsonb_agg(jsonb_build_object('account_id',x->>'account_id','amount_minor',case when (x->>'known')::boolean then x->>'balance_minor'else'0'end)),'[]')from jsonb_array_elements((select v->'accounts'from fresh where k='preview'))x$$;
create function pg_temp.apply(id uuid)returns jsonb language sql as $$select apply_personal_fresh_start($1,(select(v->>'id')::uuid from fresh where k='preview'),pg_temp.openings())$$;
create function pg_temp.fail_second_opening()returns trigger language plpgsql as $$begin
 if current_setting('test.fail_fresh',true)='on'and exists(select 1 from public.personal_period_openings where period_id=new.period_id)then
  raise exception using message='disposable_opening_failure',errcode='P0001';end if;return new;end$$;
create trigger disposable_fresh_rollback before insert on public.personal_period_openings for each row execute function pg_temp.fail_second_opening();
select ok(not has_table_privilege('authenticated','public.personal_period_expenses','INSERT,UPDATE,DELETE'),'no direct membership writes');
select ok(not has_function_privilege('authenticated','private.personal_period_snapshot(uuid)','EXECUTE'),'private snapshot is not an authority bypass');
set local role authenticated;
select pg_temp.claims('d0250000-0000-4000-8000-000000000001');
insert into fresh values('cash',create_personal_account(gen_random_uuid(),'Period Cash','cash','MYR',10000,current_date,false));
insert into fresh values('foreign',add_personal_account_currency(gen_random_uuid(),(select(v->>'account_id')::uuid from fresh where k='cash'),'VND',(pg_temp.unit('cash')->>'version')::int,-90000,current_date)),('unknown',create_personal_account(gen_random_uuid(),'Period Unknown','bank','USD',null,null,false));
insert into fresh values('personal',create_expense_with_multicurrency_funding(gen_random_uuid(),pg_temp.payload(1000,'MYR','Old personal expense'),jsonb_build_object('mode','deferred','primary_account_id',(select v->>'account_id'from fresh where k='cash'),'legs','[]'::jsonb)));
insert into fresh values('shared',jsonb_build_object('id',create_expense(gen_random_uuid(),'direct',null,1800,'MYR','Protected shared','Food',current_date,array[current_participant_id(),(select id from participants where auth_user_id='d0250000-0000-4000-8000-000000000002')],array[1800::bigint,0::bigint],array[900::bigint,900::bigint])));
select is(get_personal_ledger_period_state()->'periods','[]'::jsonb,'legacy account starts without fabricated periods');
select pg_temp.review();
select is((select(v->>'personal_count')::int from fresh where k='preview'),1,'server classifies only the personal record');
select ok((select(v->>'protected_shared_count')::int>=1 from fresh where k='preview'),'shared reference is protected');
select is((select(v->>'pending_funding_count')::int from fresh where k='preview'),1,'pending deduction disclosed and carried');
select is((select v->>'policy'from fresh where k='preview'),'carry_all','explicit approved ongoing policy');
-- Ongoing obligations must survive the real reset, including their later postings.
insert into fresh values('credit',create_personal_account(gen_random_uuid(),'Period Credit','credit_card','MYR',0,current_date,false));
insert into fresh values('installment',create_installment_purchase(gen_random_uuid(),'personal',null,90000,'VND','Old installment purchase','Travel',current_date,array[current_participant_id()],array[90000::bigint],array[90000::bigint],gen_random_uuid(),(select(v->>'account_id')::uuid from fresh where k='credit'),11360,gen_random_uuid(),(select(v->>'account_id')::uuid from fresh where k='cash'),'n_installments',4,current_date+31,'Asia/Bangkok','00:00'));
insert into fresh values('recurring',create_personal_recurring_rule(gen_random_uuid(),'Continuing rent','Existing recurring rule',100,'MYR','Housing',(select(v->>'account_id')::uuid from fresh where k='cash'),'monthly',extract(day from current_date+1)::int,null,'Asia/Bangkok','00:00',current_date+1,null,'auto_post'));
insert into fresh values('obligations-before',jsonb_build_object('plans',(select jsonb_agg(to_jsonb(x)order by x.id)from personal_installment_plans x),'installments',(select jsonb_agg(to_jsonb(x)order by x.id)from personal_installments x),'rules',(select jsonb_agg(to_jsonb(x)order by x.id)from personal_recurring_rules x)));
select pg_temp.review();
select is((select(v->>'ongoing_installment_count')::int from fresh where k='preview'),1,'preview discloses continuing active installment plan');
select is((select(v->>'recurring_rule_count')::int from fresh where k='preview'),1,'preview discloses continuing recurring rule');
select pg_temp.claims('d0250000-0000-4000-8000-000000000001',600);
select throws_ok($$select pg_temp.apply('e0250000-0000-4000-8000-000000000001')$$,'P0001','fresh_start_reauthentication_required','refreshed iat cannot replace old signed AMR');
select is((select count(*)from personal_ledger_periods),0::bigint,'reauth failure rolls back all periods');
select pg_temp.claims('d0250000-0000-4000-8000-000000000002');
select throws_ok($$select get_personal_fresh_start_preview((select(v->>'id')::uuid from fresh where k='preview'))$$,'P0001','fresh_start_preview_expired','another identity cannot read preview');
select throws_ok($$select pg_temp.apply('e0250000-0000-4000-8000-000000000002')$$,'P0001','fresh_start_preview_expired','another identity cannot apply owner preview');
select is((select count(*)from personal_fresh_start_previews),0::bigint,'preview RLS hides owner rows');
select pg_temp.claims('d0250000-0000-4000-8000-000000000001');
select throws_ok($$select apply_personal_fresh_start(gen_random_uuid(),(select(v->>'id')::uuid from fresh where k='preview'),'[]')$$,'P0001','fresh_start_openings_incomplete','all account currencies require review');
select pg_temp.review();
insert into fresh values('new-before',to_jsonb(create_expense(gen_random_uuid(),'personal',null,200,'MYR','Stale review edit','Food',current_date,array[current_participant_id()],array[200::bigint],array[200::bigint])));
select throws_ok($$select pg_temp.apply('e0250000-0000-4000-8000-000000000003')$$,'P0001','fresh_start_preview_changed','intervening authoritative edit invalidates review');
select is((select count(*)from personal_ledger_periods),0::bigint,'stale preview cannot partly archive history');
select pg_temp.review();
insert into fresh values('command',jsonb_build_object('preview',(select v->>'id'from fresh where k='preview'),'openings',pg_temp.openings()));
select ok((select(x->>'opening_locked')::boolean from jsonb_array_elements((select v->'accounts'from fresh where k='preview'))x where x->>'account_id'=(select v->>'account_id'from fresh where k='credit')),'active installment native principal is locked to the recorded baseline');
select throws_ok($$select apply_personal_fresh_start(gen_random_uuid(),(select(v->>'id')::uuid from fresh where k='preview'),
 (select jsonb_agg(case when x->>'account_id'=(select v->>'account_id'from fresh where k='credit')then jsonb_set(x,'{amount_minor}',to_jsonb(((x->>'amount_minor')::bigint+1)::text))else x end)from jsonb_array_elements(pg_temp.openings())x))$$,'P0001','fresh_start_opening_linked_obligation','Fresh Start cannot erase or invent an active installment principal through a changed opening');
insert into fresh values('rollback-before',get_personal_multicurrency_accounts());
set local test.fail_fresh='on';
select throws_ok($$select pg_temp.apply('e0250000-0000-4000-8000-000000000006')$$,'P0001','disposable_opening_failure','failure after an earlier account opening rolls the entire operation back');
set local test.fail_fresh='off';
select is(get_personal_multicurrency_accounts(),(select v from fresh where k='rollback-before'),'all native balances, revisions and entries unchanged after mid-operation failure');
select is((select count(*)from personal_ledger_periods),0::bigint,'mid-operation failure cannot partly create an epoch');
select is((select count(*)from personal_fresh_start_operations where request_id='e0250000-0000-4000-8000-000000000006'),0::bigint,'failed transaction cannot leave a false committed receipt');
insert into fresh values('receipt',pg_temp.apply('e0250000-0000-4000-8000-000000000004'));
select is((select v->>'policy'from fresh where k='receipt'),'carry_all','committed receipt confirms policy');
select is((select count(*)from personal_ledger_periods where status='active'),1::bigint,'exactly one active period');
select is((select count(*)from personal_ledger_periods where status='archived'),1::bigint,'prior personal period archived');
select is(pg_temp.balance('cash'),10000::bigint,'known opening preserves original native balance');
select is(pg_temp.balance('foreign'),-90000::bigint,'negative foreign balance retained without conversion');
select is(pg_temp.balance('credit'),11360::bigint,'installment liability principal is never fabricated or erased');
select is(jsonb_build_object('plans',(select jsonb_agg(to_jsonb(x)order by x.id)from personal_installment_plans x),'installments',(select jsonb_agg(to_jsonb(x)order by x.id)from personal_installments x),'rules',(select jsonb_agg(to_jsonb(x)order by x.id)from personal_recurring_rules x)),(select v from fresh where k='obligations-before'),'plan, future installments and recurring rule facts are byte-equivalent');
select is(pg_temp.balance('unknown'),0::bigint,'unknown opening becomes the explicitly reviewed value');
select is((select count(*)from personal_period_openings),4::bigint,'one opening snapshot per native unit');
select is((select status from personal_funding_intents where id=(select(v->'funding'->>'funding_intent_id')::uuid from fresh where k='personal')),'pending','pending deduction remains pending');
select ok((get_personal_ledger_period_state()->'archived_expense_ids')? (select v->>'expense_id'from fresh where k='personal'),'old purely personal spending excluded from active reporting');
select is((select count(*)from personal_period_expenses where expense_id=(select(v->>'id')::uuid from fresh where k='shared')),0::bigint,'shared membership never archived');
select is((select total_minor from expenses where id=(select(v->>'expense_id')::uuid from fresh where k='personal')),1000::bigint,'immutable original expense unchanged');
select is(pg_temp.apply('e0250000-0000-4000-8000-000000000004'),(select v from fresh where k='receipt'),'identical retry returns exact receipt');
select is((select count(*)from personal_period_openings),4::bigint,'retry cannot create duplicate openings');
select throws_ok($$select apply_personal_fresh_start('e0250000-0000-4000-8000-000000000004',(select(v->>'preview')::uuid from fresh where k='command'),'[]')$$,'P0001','idempotency_conflict','changed retry payload rejected');
select is(reconcile_personal_fresh_start('e0250000-0000-4000-8000-000000000004')->'result',(select v from fresh where k='receipt'),'lost response reconciles exact committed result');
select is(reconcile_personal_fresh_start('e0250000-0000-4000-8000-000000000005')->>'state','fenced','unposted request safely fenced');
select throws_ok($$select pg_temp.apply('e0250000-0000-4000-8000-000000000005')$$,'P0001','fresh_start_request_fenced','late original cannot post after reconciliation');
select is(jsonb_array_length(get_personal_ledger_archive((select(v->>'archived_period_id')::uuid from fresh where k='receipt'))->'expenses'),3,'archive retains personal records and dates');
select pg_temp.claims('d0250000-0000-4000-8000-000000000002');
select throws_ok($$select get_personal_ledger_archive((select(v->>'archived_period_id')::uuid from fresh where k='receipt'))$$,'P0001','personal_archive_unavailable','other user cannot read archive');
select is((select count(*)from personal_ledger_periods),0::bigint,'period RLS isolates financial principal');
select pg_temp.claims('d0250000-0000-4000-8000-000000000001');
insert into fresh values('late-expense',to_jsonb(create_expense(gen_random_uuid(),'personal',null,300,'MYR','New period expense backdated','Food',current_date-30,array[current_participant_id()],array[300::bigint],array[300::bigint])));
select ok(not((get_personal_ledger_period_state()->'archived_expense_ids')? (select v#>>'{}'from fresh where k='late-expense')),'new actual posting enters active period even if backdated');
select pg_temp.review();
select is((select(v->>'personal_count')::int from fresh where k='preview'),1,'next review sees only new personal spending');
select confirm_personal_funding_bundle(gen_random_uuid(),(select(v->'funding'->>'funding_intent_id')::uuid from fresh where k='personal'),1,1,
 (select jsonb_build_array(jsonb_build_object('account_id',u->>'id','version',(u->>'version')::int,'parent_version',(u->>'parent_version')::int,'amount_minor',1000,'anchor_id',a.id,'included_in_anchor',false))from(select pg_temp.unit('cash')u)q join lateral(select id from personal_account_balance_anchors where account_id=(q.u->>'id')::uuid order by anchor_sequence desc limit 1)a on true),true);
select is(pg_temp.balance('cash'),9000::bigint,'later actual not-included deduction reduces balance exactly once');
select is(jsonb_array_length(get_personal_ledger_period_state()->'later_funding'),1,'late original-expense funding appears as new-period cash activity');
select ok((get_personal_ledger_period_state()->'archived_expense_ids')? (select v->>'expense_id'from fresh where k='personal'),'later funding never repeats old personal spending');
-- A pending shared cash movement has no safe bank-inclusion inference.
select pg_temp.claims('d0250000-0000-4000-8000-000000000002');
select respond_to_direct_expense((select(v->>'id')::uuid from fresh where k='shared'),'accepted',1);
insert into fresh values('pending-shared-cash',to_jsonb(propose_settlement(gen_random_uuid(),'direct',null,'MYR',200,current_date,
 array[(select id from participants where auth_user_id='d0250000-0000-4000-8000-000000000001')],array[200::bigint],
 'Continuing pending cash',null,900,array[(select(v->>'id')::uuid from fresh where k='shared')],array[200::bigint],null)));
select pg_temp.claims('d0250000-0000-4000-8000-000000000001');
select pg_temp.review();
select ok((select bool_and((x->>'opening_locked')::boolean)from jsonb_array_elements((select v->'accounts'from fresh where k='preview'))x),'unbound pending shared cash conservatively locks current native balances');
insert into fresh values('shared-cash-before',jsonb_build_object('balance',pg_temp.balance('cash'),'payment',(select to_jsonb(x)from settlement_payments x where id=(select(v#>>'{}')::uuid from fresh where k='pending-shared-cash'))));
select throws_ok($$select apply_personal_fresh_start(gen_random_uuid(),(select(v->>'id')::uuid from fresh where k='preview'),
 (select jsonb_agg(case when x->>'account_id'=(select v->>'account_id'from fresh where k='cash')then jsonb_set(x,'{amount_minor}',to_jsonb(((x->>'amount_minor')::bigint+200)::text))else x end)from jsonb_array_elements(pg_temp.openings())x))$$,'P0001','fresh_start_opening_linked_obligation','an observed opening cannot count a pending shared cash movement early');
select lives_ok($$select pg_temp.apply('e0250000-0000-4000-8000-000000000010')$$,'keeping recorded balances permits Fresh Start with continuing pending shared cash');
select is(jsonb_build_object('balance',pg_temp.balance('cash'),'payment',(select to_jsonb(x)from settlement_payments x where id=(select(v#>>'{}')::uuid from fresh where k='pending-shared-cash'))),(select v from fresh where k='shared-cash-before'),'shared pending cash and native balance stay identical after the safe new period');
insert into fresh values('linked-unknown',add_personal_account_currency(gen_random_uuid(),(select(v->>'account_id')::uuid from fresh where k='cash'),'JPY',(pg_temp.unit('cash')->>'version')::int,null,null));
select pg_temp.review();
select ok((select(v->'conflicts')?'linked_obligation_unknown_balance'from fresh where k='preview'),'unknown native balance linked to pending shared cash blocks review without zero fallback');
select throws_ok($$select pg_temp.apply('e0250000-0000-4000-8000-000000000011')$$,'P0001','fresh_start_review_required','client cannot bypass the linked unknown-balance gate');

select pg_temp.claims('d0250000-0000-4000-8000-000000000001',0,true);
select throws_ok($$select preview_personal_fresh_start()$$,'P0001','permanent_account_required','anonymous cannot start a ledger reset');
reset role;
select * from finish();rollback;
