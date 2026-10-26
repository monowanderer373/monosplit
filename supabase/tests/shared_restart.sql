-- Disposable only. Full-reset is an explicit product policy; no fake payment or expense copy.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',('d0260000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','restart-'||n||'@example.test','',now(),'{"provider":"email","providers":["email"]}','{"display_name":"Restart test"}',now(),now()from generate_series(1,4)n;
create temp table restart(k text primary key,v jsonb);grant all on restart to authenticated;
insert into restart select 'actor'||n,to_jsonb(p.id)from generate_series(1,4)n join public.participants p on p.auth_user_id=('d0260000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
insert into public.friendships(participant_low_id,participant_high_id,requested_by,status,accepted_at)
select least((a.v#>>'{}')::uuid,(b.v#>>'{}')::uuid),greatest((a.v#>>'{}')::uuid,(b.v#>>'{}')::uuid),(a.v#>>'{}')::uuid,'accepted',now()
from restart a,restart b where a.k like 'actor%'and b.k like 'actor%'and a.k<b.k;
create function pg_temp.actor(n int)returns uuid language sql as $$select(v#>>'{}')::uuid from restart where k='actor'||n$$;
create function pg_temp.claim(n int,guest boolean default false)returns void language plpgsql as $$begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub','d0260000-0000-4000-8000-'||lpad(n::text,12,'0'),'role','authenticated','is_anonymous',guest,'iat',extract(epoch from now())::bigint)::text,true);end$$;
create function pg_temp.id(k text)returns uuid language sql as $$select(v#>>'{}')::uuid from restart where restart.k=$1$$;
create function pg_temp.accept_bill(k text)returns jsonb language sql as $$select respond_to_direct_expense(pg_temp.id($1),'accepted',1)$$;
create function pg_temp.balance(other int,code text default 'MYR')returns bigint language sql as $$select(get_direct_outstanding(pg_temp.actor($1),$2)->>'signed_outstanding_minor')::bigint$$;
create function pg_temp.preview(key_name text)returns jsonb language plpgsql as $$declare v jsonb;begin v:=preview_personal_fresh_start();insert into restart values($1,v)on conflict(k)do update set v=excluded.v;return v;end$$;
create function pg_temp.reset(k text,request uuid)returns jsonb language sql as $$select apply_personal_fresh_start_v2($2,(select(v->>'id')::uuid from restart where restart.k=$1),(select coalesce(jsonb_agg(jsonb_build_object('account_id',a->>'account_id','amount_minor',a->>'balance_minor')),'[]')from restart,lateral jsonb_array_elements(v->'accounts')a where restart.k=$1))$$;
-- Regression witness: the former aggregate FIFO reassigns a past payment after a later retag.
create function pg_temp.aggregate_fifo_before_fix(actor uuid)
 returns table(expense_id uuid,debtor_id uuid,creditor_id uuid,remaining_minor bigint)
 language sql stable security definer set search_path='' as $$
 with raw as(
 select e.id,e.scope,e.space_id,e.currency,e.occurred_on,e.created_at,d.participant_id debtor,c.participant_id creditor,
 private.shared_potential_expense_obligation(e.id,d.participant_id,c.participant_id) original_minor,
 private.shared_raw_expense_obligation(e.id,d.participant_id,c.participant_id) actual_minor
 from public.expenses e join public.expense_participations d on d.expense_id=e.id
 join public.expense_participations c on c.expense_id=e.id and c.participant_id<>d.participant_id
 where e.status='active' and e.scope in('direct','space')
 ), amounts as(
 select *,private.shared_restart_amount(id,debtor,creditor,actual_minor) effective_minor,
 private.latest_shared_restart_edge(id,debtor,creditor) prior_edge
 from raw where original_minor>0
 ), ranked as(
 select *,coalesce(sum(effective_minor)over(partition by scope,space_id,currency,debtor,creditor
 order by occurred_on,created_at,id rows between unbounded preceding and 1 preceding),0) prior_minor
 from amounts
 ), transfers as(
 select p.scope,p.space_id,p.currency,p.debtor_participant_id debtor,a.creditor_participant_id creditor,
 sum(case when a.state='reversed' then 0 else a.amount_minor-coalesce((select sum(r.amount_minor)from public.settlement_allocation_reversals r where r.settlement_allocation_id=a.id),0)end) net_minor
 from public.settlement_payments p join public.settlement_allocations a on a.settlement_payment_id=p.id
 where a.state in('accepted','reversed')and not private.shared_allocation_cleared(a.id)
 group by p.scope,p.space_id,p.currency,p.debtor_participant_id,a.creditor_participant_id
 )
 select r.id,r.debtor,r.creditor,
 case when r.actual_minor=0 then r.original_minor
 when r.prior_edge is not null and r.effective_minor=0 then least(r.original_minor,(select x.remaining_minor from public.shared_restart_edges x where x.id=r.prior_edge))
 else greatest(0,r.effective_minor-greatest(0,coalesce(t.net_minor,0)-r.prior_minor))::bigint end
 from ranked r left join transfers t on t.scope=r.scope and t.space_id is not distinct from r.space_id
 and t.currency=r.currency and t.debtor=r.debtor and t.creditor=r.creditor
 where actor in(r.debtor,r.creditor);
$$;
set local role authenticated;
select pg_temp.claim(1);
insert into restart values('bill-ab',to_jsonb(create_expense(gen_random_uuid(),'direct',null,2000,'MYR','Original AB','Food',current_date-1,array[pg_temp.actor(1),pg_temp.actor(2)],array[2000::bigint,0],array[1000::bigint,1000])));
insert into restart values('private-three',to_jsonb(create_expense(gen_random_uuid(),'direct',null,600,'USD','Three-person private payment','Food',current_date,array[pg_temp.actor(1),pg_temp.actor(2),pg_temp.actor(3)],array[600::bigint,0,0],array[200::bigint,200,200])));
insert into restart values('pending-ab',to_jsonb(create_expense(gen_random_uuid(),'direct',null,200,'CNY','Pending AB','Food',current_date,array[pg_temp.actor(1),pg_temp.actor(2)],array[200::bigint,0],array[100::bigint,100])));
insert into restart values('bill-ac',to_jsonb(create_expense(gen_random_uuid(),'direct',null,90000,'VND','Original AC','Food',current_date,array[pg_temp.actor(1),pg_temp.actor(3)],array[90000::bigint,0],array[45000::bigint,45000])));
select pg_temp.claim(2);select pg_temp.accept_bill('bill-ab');select pg_temp.accept_bill('private-three');
insert into restart values('bill-ba',to_jsonb(create_expense(gen_random_uuid(),'direct',null,1000,'MYR','Original BA','Food',current_date,array[pg_temp.actor(2),pg_temp.actor(1)],array[1000::bigint,0],array[500::bigint,500])));
insert into restart values('pending-ba',to_jsonb(create_expense(gen_random_uuid(),'direct',null,200,'JPY','Pending BA','Food',current_date,array[pg_temp.actor(2),pg_temp.actor(1)],array[200::bigint,0],array[100::bigint,100])));
insert into restart values('bill-bc',to_jsonb(create_expense(gen_random_uuid(),'direct',null,1000,'MYR','Other pair','Food',current_date,array[pg_temp.actor(2),pg_temp.actor(3)],array[1000::bigint,0],array[500::bigint,500])));
insert into restart values('paid',to_jsonb(propose_settlement(gen_random_uuid(),'direct',null,'MYR',200,current_date,array[pg_temp.actor(1)],array[200::bigint],null)));
insert into restart values('pending',to_jsonb(propose_settlement(gen_random_uuid(),'direct',null,'MYR',100,current_date,array[pg_temp.actor(1)],array[100::bigint],null)));
select pg_temp.claim(3);select pg_temp.accept_bill('bill-ac');select respond_to_direct_expense(pg_temp.id('private-three'),'accepted',2);
insert into restart values('private-payment',to_jsonb(propose_settlement(gen_random_uuid(),'direct',null,'USD',50,current_date,array[pg_temp.actor(1)],array[50::bigint],null)));
select pg_temp.claim(1);select respond_to_settlement((select id from settlement_allocations where settlement_payment_id=pg_temp.id('private-payment')),'accepted',1);
select pg_temp.claim(3);select pg_temp.accept_bill('bill-bc');
select pg_temp.claim(1);select pg_temp.accept_bill('bill-ba');
select respond_to_settlement((select id from settlement_allocations where settlement_payment_id=pg_temp.id('paid')),'accepted',1);
select is(pg_temp.balance(2),-300::bigint,'initial two-way debt nets actual payment with original F=E-T+R');
select pg_temp.claim(2);
insert into restart values('group',to_jsonb(create_space(space_type=>'group',space_name=>'Reset group',default_currency=>'MYR')));
insert into restart values('group-invite-a',to_jsonb(create_space_invite(pg_temp.id('group'),'full_access')));
insert into restart values('group-invite-c',to_jsonb(create_space_invite(pg_temp.id('group'),'full_access')));
select pg_temp.claim(1);select accept_space_invite((select v#>>'{}'from restart where k='group-invite-a'));
select pg_temp.claim(3);select accept_space_invite((select v#>>'{}'from restart where k='group-invite-c'));
select pg_temp.claim(2);
insert into restart values('group-bill',to_jsonb(create_expense(gen_random_uuid(),'space',pg_temp.id('group'),300,'MYR','One shared group bill','Food',current_date,array[pg_temp.actor(1),pg_temp.actor(2),pg_temp.actor(3)],array[0::bigint,300,0],array[100::bigint,100,100])));
select pg_temp.claim(1);

insert into restart values('facts',jsonb_build_object('expenses',(select jsonb_agg(to_jsonb(e)order by e.id)from expenses e),'shares',(select jsonb_agg(to_jsonb(s)order by s.expense_participation_id)from expense_shares s),'cash',(select count(*)from personal_account_entries)));
select pg_temp.preview('preview-a');
insert into restart values('receipt-a',pg_temp.reset('preview-a','e0260000-0000-4000-8000-000000000001'));
select is(pg_temp.balance(2),0::bigint,'reset clears owner receivables and payables instead of hiding a nonzero debt');
select is(pg_temp.balance(3,'VND'),0::bigint,'reset clears a second currency without reference FX');
select is((get_personal_ledger_period_state()->>'shared_restart_version')::int,1,'server advertises full-reset capability');
select ok((select(shared_restart_state(e)->>'hidden_for_viewer')::boolean from expenses e where id=pg_temp.id('bill-ab')),'owner old Split leaves current records');
select is(jsonb_build_object('expenses',(select jsonb_agg(to_jsonb(e)order by e.id)from expenses e),'shares',(select jsonb_agg(to_jsonb(s)order by s.expense_participation_id)from expense_shares s),'cash',(select count(*)from personal_account_entries)),(select v from restart where k='facts'),'reset preserves original bills/shares and posts no payment/cash');
select throws_ok($$select respond_to_settlement((select id from settlement_allocations where settlement_payment_id=pg_temp.id('pending')),'accepted',1)$$,'P0001','shared_split_cleared','old pending settlement cannot resurrect a cleared balance or post money');
select pg_temp.claim(2);
select is(pg_temp.balance(1),0::bigint,'counterparty current relation agrees with the reset; bill history remains');
select is((select jsonb_array_length(shared_restart_state(e)->'edges')from expenses e where id=pg_temp.id('private-three')),1,'third Direct participant sees only their own reset edge');
select is((select count(*)from shared_restart_edges where expense_id=pg_temp.id('private-three')),1::bigint,'RLS hides another Direct pair unpaid amount and private payment');

select is(pg_temp.balance(3),-500::bigint,'unrelated third-person debt is unchanged');
select pg_temp.claim(3);
select lives_ok($$select propose_settlement(gen_random_uuid(),'space',pg_temp.id('group'),'MYR',100,current_date,array[pg_temp.actor(2)],array[100::bigint],null,null,100,null,null,null)$$,'other two members in the SAME bill retain their original100 debt');
select throws_ok($$select propose_settlement(gen_random_uuid(),'space',pg_temp.id('group'),'MYR',101,current_date,array[pg_temp.actor(2)],array[101::bigint],null,null,100,null,null,null)$$,'P0001','amount_exceeds_outstanding_balance','reset does not redistribute the cleared member share to another group member');
select pg_temp.claim(2);

select ok(not(select(shared_restart_state(e)->>'hidden_for_viewer')::boolean from expenses e where id=pg_temp.id('bill-ab')),'counterparty retains the original bill');
insert into restart values('edge-ab',to_jsonb((select id from shared_restart_edges where expense_id=pg_temp.id('bill-ab')and debtor_id=pg_temp.actor(2)order by created_at desc,id desc limit 1)));
select is((select remaining_minor from shared_restart_edges where id=pg_temp.id('edge-ab')),800::bigint,'retag snapshot subtracts previously accepted actual payment');
insert into restart values('retag-decline',to_jsonb(request_shared_split_retag('e0260000-0000-4000-8000-000000000002',pg_temp.id('edge-ab'),pg_temp.id('bill-ab'),(select version from expenses where id=pg_temp.id('bill-ab')))));
select is(request_shared_split_retag('e0260000-0000-4000-8000-000000000002',pg_temp.id('edge-ab'),pg_temp.id('bill-ab'),(select version from expenses where id=pg_temp.id('bill-ab'))),pg_temp.id('retag-decline'),'same request is idempotent');
select is(pg_temp.balance(1),0::bigint,'retag request alone contributes no confirmed debt');
select pg_temp.claim(3);
select throws_ok($$select request_shared_split_retag(gen_random_uuid(),pg_temp.id('edge-ab'),pg_temp.id('bill-ab'),1)$$,'P0001','shared_retag_unavailable','third party cannot retag another private pair');
select pg_temp.claim(1);
select is(respond_shared_split_retag(pg_temp.id('retag-decline'),'declined',(select version from expenses where id=pg_temp.id('bill-ab'))),'declined','recipient can decline a retag');
select is(pg_temp.balance(2),0::bigint,'decline leaves reset at zero');
select pg_temp.claim(2);
insert into restart values('retag-accept',to_jsonb(request_shared_split_retag('e0260000-0000-4000-8000-000000000003',pg_temp.id('edge-ab'),pg_temp.id('bill-ab'),(select version from expenses where id=pg_temp.id('bill-ab')))));
select pg_temp.claim(1);
select is(respond_shared_split_retag(pg_temp.id('retag-accept'),'accepted',(select version from expenses where id=pg_temp.id('bill-ab'))),'accepted','explicit acceptance restores original unpaid amount');
select is(pg_temp.balance(2),-800::bigint,'only unpaid bill amount is restored, not a second whole bill');
select is(respond_shared_split_retag(pg_temp.id('retag-accept'),'accepted',(select version from expenses where id=pg_temp.id('bill-ab'))),'accepted','duplicate acceptance does not create another obligation');
select ok(not(select(shared_restart_state(e)->>'hidden_for_viewer')::boolean from expenses e where id=pg_temp.id('bill-ab')),'accepted re-tag returns original record to current Shared');
select is(jsonb_build_object('expenses',(select jsonb_agg(to_jsonb(e)order by e.id)from expenses e),'shares',(select jsonb_agg(to_jsonb(s)order by s.expense_participation_id)from expense_shares s),'cash',(select count(*)from personal_account_entries)),(select v from restart where k='facts'),'retag acceptance creates neither another purchase nor a cash deduction');
-- A prior unaccepted invitation is only a review candidate, never a confirmed contribution.
select pg_temp.claim(2);
insert into restart values('pending-edge-ba',to_jsonb((select id from shared_restart_edges where expense_id=pg_temp.id('pending-ba')and debtor_id=pg_temp.actor(1)order by release_sequence desc limit 1)));
select is((select remaining_minor from shared_restart_edges where id=pg_temp.id('pending-edge-ba')),100::bigint,'pending invitation stores a potential amount without confirming it');
insert into restart values('pending-retag-ba',to_jsonb(request_shared_split_retag(gen_random_uuid(),pg_temp.id('pending-edge-ba'),pg_temp.id('pending-ba'),1)));
select pg_temp.claim(1);select is(pg_temp.balance(2,'JPY'),0::bigint,'pending re-tag remains outside current finance');
select is(respond_shared_split_retag(pg_temp.id('pending-retag-ba'),'accepted',1),'accepted','new explicit retag uses the original pending-participation RPC');
select is(pg_temp.balance(2,'JPY'),100::bigint,'only explicit acceptance contributes pending original share');
select is(respond_shared_split_retag(pg_temp.id('pending-retag-ba'),'accepted',1),'accepted','lost pending-accept response can be replayed after source version advances');
select pg_temp.claim(2);
insert into restart values('pending-edge-ab',to_jsonb((select id from shared_restart_edges where expense_id=pg_temp.id('pending-ab')and debtor_id=pg_temp.actor(2)order by release_sequence desc limit 1)));
insert into restart values('pending-retag-ab',to_jsonb(request_shared_split_retag('e0260000-0000-4000-8000-000000000006',pg_temp.id('pending-edge-ab'),pg_temp.id('pending-ab'),1)));
select is(request_shared_split_retag('e0260000-0000-4000-8000-000000000006',pg_temp.id('pending-edge-ab'),pg_temp.id('pending-ab'),1),pg_temp.id('pending-retag-ab'),'pending requestor consent preserves the original request fingerprint');
select is(pg_temp.balance(1,'CNY'),0::bigint,'requestor consent does not bypass reset recipient approval');
select pg_temp.claim(1);select is(respond_shared_split_retag(pg_temp.id('pending-retag-ab'),'accepted',2),'accepted','reset recipient approves the current version after requestor consent');
select is(pg_temp.balance(2,'CNY'),-100::bigint,'two explicit consents restore the original pending bill once');
select pg_temp.claim(2);
select throws_ok($$select dismiss_shared_restart_bill(pg_temp.id('bill-ab'))$$,'P0001','shared_bill_still_active','a restored active split cannot be silently deleted');
select pg_temp.claim(1);select pg_temp.preview('preview-a2');select pg_temp.reset('preview-a2','e0260000-0000-4000-8000-000000000004');
select is(pg_temp.balance(2),0::bigint,'a second explicit reset clears restored obligations again');
-- A new bill is paid before the original unpaid bill is tagged again. Its payment
-- must stay with that new bill when another Reset snapshots old unpaid amounts.
insert into restart values('paid-new-bill',to_jsonb(create_expense(gen_random_uuid(),'direct',null,400,'MYR','Paid new bill','Food',current_date,array[pg_temp.actor(1),pg_temp.actor(2)],array[400::bigint,0],array[200::bigint,200])));
select pg_temp.claim(2);select pg_temp.accept_bill('paid-new-bill');
insert into restart values('new-payment',to_jsonb(propose_settlement(gen_random_uuid(),'direct',null,'MYR',200,current_date,array[pg_temp.actor(1)],array[200::bigint],null)));
select pg_temp.claim(1);select respond_to_settlement((select id from settlement_allocations where settlement_payment_id=pg_temp.id('new-payment')),'accepted',1);
select is(pg_temp.balance(2),0::bigint,'new bill is genuinely fully paid before old retag');
select pg_temp.claim(2);
insert into restart values('later-old-edge',to_jsonb((select id from shared_restart_edges where expense_id=pg_temp.id('bill-ab')and debtor_id=pg_temp.actor(2)order by release_sequence desc limit 1)));
insert into restart values('later-old-tag',to_jsonb(request_shared_split_retag(gen_random_uuid(),pg_temp.id('later-old-edge'),pg_temp.id('bill-ab'),(select version from expenses where id=pg_temp.id('bill-ab')))));
select pg_temp.claim(1);select respond_shared_split_retag(pg_temp.id('later-old-tag'),'accepted',(select version from expenses where id=pg_temp.id('bill-ab')));
select is(pg_temp.balance(2),-800::bigint,'later retag only adds the unpaid original800');
select is((select remaining_minor from pg_temp.aggregate_fifo_before_fix(pg_temp.actor(1))where expense_id=pg_temp.id('bill-ab')and debtor_id=pg_temp.actor(2)),600::bigint,'regression reproduced: former aggregate FIFO steals new bill payment');
select pg_temp.preview('chronology-preview');select pg_temp.reset('chronology-preview','e0260000-0000-4000-8000-000000000007');
select is((select remaining_minor from shared_restart_edges where expense_id=pg_temp.id('bill-ab')and debtor_id=pg_temp.actor(2)order by release_sequence desc limit 1),800::bigint,'event-time snapshot preserves unpaid original amount');
select is((select remaining_minor from shared_restart_edges where expense_id=pg_temp.id('paid-new-bill')and debtor_id=pg_temp.actor(2)order by release_sequence desc limit 1),0::bigint,'paid new bill is never made unpaid by a later old retag');
select pg_temp.claim(2);
select throws_ok($$select request_shared_split_retag(gen_random_uuid(),(select id from shared_restart_edges where expense_id=pg_temp.id('paid-new-bill')and debtor_id=pg_temp.actor(2)order by release_sequence desc limit 1),pg_temp.id('paid-new-bill'),(select version from expenses where id=pg_temp.id('paid-new-bill')))$$,'P0001','shared_retag_unavailable','already paid bill cannot be re-tagged for a second collection');
select pg_temp.claim(1);

select pg_temp.claim(2);select dismiss_shared_restart_bill(pg_temp.id('bill-ab'));
select ok((select(shared_restart_state(e)->>'hidden_for_viewer')::boolean from expenses e where id=pg_temp.id('bill-ab')),'counterparty can remove cleared bill from own records only');

-- Existing versioned corrections keep the exact Participant array. A newly
-- reversed pairing must remain cleared until explicitly re-tagged and accepted.
select pg_temp.claim(1);
insert into restart values('correction',propose_direct_expense_change(gen_random_uuid(),pg_temp.id('bill-ab'),(select version from expenses where id=pg_temp.id('bill-ab')),'correction','Correct original payer',2000,'MYR','Corrected original bill','Food',current_date,array[pg_temp.actor(1),pg_temp.actor(2)],array[0::bigint,2000],array[1000::bigint,1000]));
select pg_temp.claim(2);select respond_to_direct_expense_change((select(v->>'request_id')::uuid from restart where k='correction'),'accepted',1);
insert into restart values('corrected-id',(select v->'replacement_expense_id'from restart where k='correction'));
select is(pg_temp.balance(1),0::bigint,'correction alone cannot reactivate an old cleared relationship');
insert into restart values('virtual-marker',(select x->'id'from expenses e,lateral jsonb_array_elements(shared_restart_state(e)->'edges')x where e.id=pg_temp.id('corrected-id')and x->>'recipient_id'=pg_temp.actor(1)::text and x->>'debtor_id'=pg_temp.actor(1)::text));
insert into restart values('corrected-tag',to_jsonb(request_shared_split_retag('e0260000-0000-4000-8000-000000000008',pg_temp.id('virtual-marker'),pg_temp.id('corrected-id'),(select version from expenses where id=pg_temp.id('corrected-id')))));
select is(request_shared_split_retag('e0260000-0000-4000-8000-000000000008',pg_temp.id('virtual-marker'),pg_temp.id('corrected-id'),(select version from expenses where id=pg_temp.id('corrected-id'))),pg_temp.id('corrected-tag'),'virtual-marker retry reconciles the materialized edge without another request');
select pg_temp.claim(1);select respond_shared_split_retag(pg_temp.id('corrected-tag'),'accepted',(select version from expenses where id=pg_temp.id('corrected-id')));
select is(pg_temp.balance(2),1000::bigint,'explicit new pairing restores current corrected amount without copying the purchase');
select pg_temp.preview('after-correction');select pg_temp.reset('after-correction','e0260000-0000-4000-8000-000000000009');
select is(pg_temp.balance(2),0::bigint,'another full Reset also clears a corrected/re-tagged descendant');
select pg_temp.claim(2);select archive_friendship((select id from friendships where participant_low_id=least(pg_temp.actor(1),pg_temp.actor(2))and participant_high_id=greatest(pg_temp.actor(1),pg_temp.actor(2))));
select throws_ok($$select request_shared_split_retag(gen_random_uuid(),(select id from shared_restart_edges where expense_id=pg_temp.id('corrected-id')order by release_sequence desc limit 1),pg_temp.id('corrected-id'),(select version from expenses where id=pg_temp.id('corrected-id')))$$,'P0001','shared_retag_unavailable','historical bill access cannot re-tag an archived friend');
select pg_temp.claim(4);select pg_temp.preview('empty-preview');select pg_temp.reset('empty-preview','e0260000-0000-4000-8000-000000000005');
select is((select count(*)from shared_restart_completions),1::bigint,'empty Reset has an authoritative idempotence completion');
insert into restart values('new-db',to_jsonb(create_expense(gen_random_uuid(),'direct',null,200,'MYR','New epoch bill','Food',current_date,array[pg_temp.actor(4),pg_temp.actor(2)],array[200::bigint,0],array[100::bigint,100])));
select pg_temp.claim(2);select pg_temp.accept_bill('new-db');
select pg_temp.claim(4);select is(pg_temp.balance(2),-100::bigint,'new actual split remains effective after an empty reset');
select pg_temp.reset('empty-preview','e0260000-0000-4000-8000-000000000005');
select is(pg_temp.balance(2),-100::bigint,'replaying an empty Reset cannot clear later transactions');
select ok(not has_table_privilege('authenticated','public.shared_restart_edges','INSERT,UPDATE,DELETE'),'client cannot forge cleared or restored amounts');
select ok(not has_function_privilege('anon','public.apply_personal_fresh_start_v2(uuid,uuid,jsonb)','EXECUTE'),'anonymous full Reset denied');
select * from finish();
rollback;
