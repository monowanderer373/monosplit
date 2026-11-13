begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',('f1111201-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','route-'||n||'@example.test','',now(),'{"provider":"email","providers":["email"]}','{"display_name":"Proxy fixture"}',now(),now()from generate_series(1,7)n;
create temp table rr(k text primary key,v uuid);
insert into rr select 'u'||n,p.id from generate_series(1,7)n join public.participants p on p.auth_user_id=('f1111201-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
grant all on rr to authenticated;
create function pg_temp.rid(k text)returns uuid language sql as $$select v from rr where rr.k=$1$$;
create function pg_temp.rclaim(n int)returns void language plpgsql as $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub','f1111201-0000-4000-8000-'||lpad(n::text,12,'0'),'role','authenticated','is_anonymous',false)::text,true);end$$;
create function pg_temp.rpayment(k text,p int,r int,amount bigint,via int default null,route bigint default null,c text default 'VND')returns jsonb language sql as $$select jsonb_build_object('id',k,'payer',pg_temp.rid('u'||p),'recipient',pg_temp.rid('u'||r),'tenderCurrency',c,'tenderMinor',amount,'method',case when c='MYR'then'bank_transfer'else'cash'end)||case when via is null then'{}'::jsonb else jsonb_build_object('via',jsonb_build_object('person',pg_temp.rid('u'||via),'minor',route*60))end$$;
create function pg_temp.rdraft(rows jsonb)returns jsonb language sql as $$select jsonb_build_object('rateMode','custom','vndPerMyr','6000','payments',rows)$$;
create function pg_temp.rbill(trip uuid,creditor int,debtor int,n bigint,c text default 'VND')returns uuid language plpgsql as $$declare e jsonb;begin e:=public.create_trip_expense_editor(gen_random_uuid(),trip,jsonb_build_object('expense_scope','space','target_space_id',trip,'participant_ids',array[pg_temp.rid('u'||creditor),pg_temp.rid('u'||debtor)],'contribution_amounts',array[n,0],'share_amounts',array[0,n],'total_minor',n,'currency_code',c,'description','Proxy fixture','category','Food','occurred_on','2026-11-10'),array[pg_temp.rid('u'||creditor),pg_temp.rid('u'||debtor)]);return(e->>'expense_id')::uuid;end$$;
set local role authenticated;
select pg_temp.rclaim(1);
insert into rr values('trip',public.create_space('trip','Routed isolated',null,null,'MYR'));
reset role;
insert into public.space_members(space_id,participant_id,role)select pg_temp.rid('trip'),pg_temp.rid('u'||n),'view'from unnest(array[2,3,4,5,6])n;
set local role authenticated;
select pg_temp.rclaim(1);

create temp table rv(k text primary key,v jsonb);grant all on rv to authenticated;
create function pg_temp.netdraft(rows jsonb)returns jsonb language sql as $$select pg_temp.rdraft(rows)||jsonb_build_object('edgeBasis','net','contraSnapshot',jsonb_build_object('revision',public.read_trip_contra_snapshot(pg_temp.rid('trip'),'custom','6000','MYR')->>'revision','displayCurrency','MYR'),'occurredAt',now(),'note','Isolated contra','ownAccountLinks','[]'::jsonb)$$;
create function pg_temp.netpair(a int,b int)returns jsonb language sql as $$select q from jsonb_array_elements(public.read_trip_contra_snapshot(pg_temp.rid('trip'),'custom','6000','MYR')->'pairs')q where q->>'a'=least(pg_temp.rid('u'||a)::text,pg_temp.rid('u'||b)::text)and q->>'b'=greatest(pg_temp.rid('u'||a)::text,pg_temp.rid('u'||b)::text)$$;
-- Hanoi regression numbers are synthetic original-currency bills, not production data.
select pg_temp.rbill(pg_temp.rid('trip'),1,2,2229000),pg_temp.rbill(pg_temp.rid('trip'),2,1,2286,'MYR'),pg_temp.rbill(pg_temp.rid('trip'),1,3,2229000),pg_temp.rbill(pg_temp.rid('trip'),3,1,8339,'MYR'),pg_temp.rbill(pg_temp.rid('trip'),1,4,1278180),pg_temp.rbill(pg_temp.rid('trip'),4,1,6138,'MYR');
select is((pg_temp.netpair(1,2)->'display'->>'netMinor')::bigint,34864::bigint,'Hanoi sample Chong net RM348.64 exactly once');
select is((pg_temp.netpair(1,3)->'display'->>'netMinor')::bigint,28811::bigint,'Hanoi sample Kian net RM288.11 exactly once');
select is((pg_temp.netpair(1,4)->'display'->>'netMinor')::bigint,15165::bigint,'Hanoi sample Lii net RM151.65 exactly once');
select is((select sum((q->'display'->>'netMinor')::bigint)::bigint from jsonb_array_elements(public.read_trip_contra_snapshot(pg_temp.rid('trip'),'custom','6000','MYR')->'pairs')q where q->>'recipient'=pg_temp.rid('u1')::text),78840::bigint,'David collection overview RM788.40');
select is((select count(*)from jsonb_array_elements(public.read_trip_contra_snapshot(pg_temp.rid('trip'),'custom','6000','MYR')->'pairs')q where q->>'payer'=pg_temp.rid('u1')::text),0::bigint,'David has no net payment due');
select is((pg_temp.netpair(1,2)->'ledger'->>'netMinor')::bigint,(pg_temp.netpair(1,2)->>'netMinor')::bigint,'display, chooser and server capacity share net amount');
select is((pg_temp.netpair(1,2)->'grossDisplay'->>'contraMinor')::bigint,2286::bigint,'detail shows original reverse contra RM22.86');
-- Keep independent net debts; two recipients compete for the same upstream edge.
select pg_temp.rbill(pg_temp.rid('trip'),4,5,120000),pg_temp.rbill(pg_temp.rid('trip'),1,5,2000,'MYR'),pg_temp.rbill(pg_temp.rid('trip'),2,4,120000),pg_temp.rbill(pg_temp.rid('trip'),4,6,60000);
insert into rv values('over',pg_temp.netdraft(jsonb_build_array(pg_temp.rpayment('dav',5,1,66000,4,1100),pg_temp.rpayment('chong',5,2,66000,4,1100))));
insert into rv values('over-review',public.preview_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='over')));
select is((select v->>'digest'from rv where k='over-review'),null,'whole-sheet shared upstream cap blocks over-allocation');
select ok((select v->'plan'->'issues' @> '[{"code":"SHARED_LIMIT","paymentIds":["chong","dav"]}]'::jsonb or v->'plan'->'issues' @> '[{"code":"SHARED_LIMIT","paymentIds":["dav","chong"]}]'::jsonb from rv where k='over-review'),'shared cap identifies both actual payment rows');
insert into rv values('multi',pg_temp.netdraft(jsonb_build_array(pg_temp.rpayment('dav',5,1,60000,4,1000),pg_temp.rpayment('chong',5,2,60000,4,1000))));
insert into rv values('multi-review',public.preview_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='multi')));
select is(jsonb_array_length((select v->'plan'->'issues'from rv where k='multi-review')),0,'two recipient native review succeeds at shared cap');
select is((select v->'plan'->>'ledgerCurrency'from rv where k='multi-review'),'VND','explicit-net protocol preserves existing native quote precision');
-- Only actual VND paid to David; upstream first, direct leftover second.
insert into rv values('draft',pg_temp.netdraft(jsonb_build_array((pg_temp.rpayment('actual',5,1,100000,4,1200)||jsonb_build_object('via',jsonb_build_object('person',pg_temp.rid('u4'),'minor',71980))))));
insert into rv values('review',public.preview_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='draft')));
select is((select(v->'plan'->'lines'->0->>'viaMinor')::bigint from rv where k='review'),71980::bigint,'first reduces both net route segments');
select is((select(v->'plan'->'lines'->0->>'directMinor')::bigint from rv where k='review'),28020::bigint,'then applies remaining cash to payer direct net debt');
insert into rr values('request',gen_random_uuid());
insert into rv values('record',public.record_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='draft'),pg_temp.rid('request'),(select v->>'digest'from rv where k='review'),(select(v->>'expiresAt')::timestamptz from rv where k='review'),true));
select is((pg_temp.netpair(4,5)->'display'->>'netMinor')::bigint,800::bigint,'payer to Lii decreases by chosen routed amount');
select is((pg_temp.netpair(1,4)->'display'->>'netMinor')::bigint,13965::bigint,'Lii to David decreases by same routed amount');
select is((pg_temp.netpair(1,5)->'display'->>'netMinor')::bigint,1533::bigint,'unpaid MYR remains due after direct remainder');
select is((pg_temp.netpair(2,4)->'display'->>'netMinor')::bigint,2000::bigint,'other recipient independent net debt remains unpaid');
select lives_ok($$select public.record_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='draft'),pg_temp.rid('request'),(select v->>'digest'from rv where k='review'),(select(v->>'expiresAt')::timestamptz from rv where k='review'),true)$$,'same request returns posted receipt despite newer ledger revision');
reset role;
select is((select count(*)from private.creator_receipts where record_id=(select(v->>'id')::uuid from rv where k='record')and kind='cash'),1::bigint,'one actual cash leg, no intermediary cash manufactured');
select is((select count(*)from public.settlement_payments p join private.creator_receipts r on r.payment_id=p.id where r.record_id=(select(v->>'id')::uuid from rv where k='record')and r.kind='cash'and p.debtor_participant_id=pg_temp.rid('u5')and p.currency='VND'and p.amount_minor=100000),1::bigint,'cash keeps actual payer, VND currency and tender amount');
select ok(exists(select 1 from public.financial_events e join private.creator_receipts r on r.payment_id=e.settlement_payment_id where r.record_id=(select(v->>'id')::uuid from rv where k='record')and e.safe_diff->>'application'='contra'),'noncash contra coverage is marked in immutable financial history');
select ok(not has_function_privilege('anon','public.read_trip_contra_snapshot(uuid,text,text,text)','EXECUTE'),'anonymous cannot read snapshot');
select ok(not has_function_privilege('authenticated','private.contra_matrix(uuid,jsonb)','EXECUTE'),'client cannot bypass scoped reader');
set local role authenticated;
select pg_temp.rclaim(2);
select ok(not exists(select 1 from jsonb_array_elements(public.read_trip_contra_snapshot(pg_temp.rid('trip'),'custom','6000','MYR')->'pairs')q where pg_temp.rid('u2')::text not in(q->>'a',q->>'b')),'ordinary member reads only its bilateral pairs');
select pg_temp.rclaim(7);
select throws_ok($$select public.read_trip_contra_snapshot(pg_temp.rid('trip'),'custom','6000','MYR')$$,'P0001','space_membership_required','unrelated actor cannot read Trip net facts');
select pg_temp.rclaim(1);
select throws_ok($$select public.preview_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='multi'))$$,'P0001','contra_snapshot_changed','stale net snapshot cannot authorize a new payment');
insert into rv values('reverse',public.reverse_trip_creator_settlement((select(v->>'id')::uuid from rv where k='record'),gen_random_uuid(),1,'Isolated undo'));
select is((pg_temp.netpair(1,4)->'display'->>'netMinor')::bigint,15165::bigint,'whole reversal restores downstream native net');
select is((pg_temp.netpair(4,5)->'display'->>'netMinor')::bigint,2000::bigint,'whole reversal restores upstream native net');
select is((pg_temp.netpair(1,5)->'display'->>'netMinor')::bigint,2000::bigint,'whole reversal restores direct MYR');
-- Real cross-currency partial coverage before/after delta is exact, not value(coverage).
insert into rr values('partial-trip',public.create_space('trip','Rounding isolated',null,null,'MYR'));
reset role;
insert into public.space_members(space_id,participant_id,role)values(pg_temp.rid('partial-trip'),pg_temp.rid('u2'),'view');
set local role authenticated;
select pg_temp.rbill(pg_temp.rid('partial-trip'),1,2,400000),pg_temp.rbill(pg_temp.rid('partial-trip'),2,1,2000,'MYR');
insert into rv values('partial-snapshot',public.read_trip_contra_snapshot(pg_temp.rid('partial-trip'),'custom','6000','MYR'));
insert into rv values('partial-draft',pg_temp.rdraft(jsonb_build_array(pg_temp.rpayment('partial',2,1,100000)))||jsonb_build_object('edgeBasis','net','contraSnapshot',jsonb_build_object('revision',(select v->>'revision'from rv where k='partial-snapshot'),'displayCurrency','MYR'),'occurredAt',now(),'note','','ownAccountLinks','[]'::jsonb));
insert into rv values('partial-review',public.preview_trip_creator_settlement(pg_temp.rid('partial-trip'),(select v from rv where k='partial-draft')));
select is(jsonb_array_length((select v->'plan'->'issues'from rv where k='partial-review')),0,'nonintegral FX partial is represented without rounding tolerance');
insert into rv values('partial-record',public.record_trip_creator_settlement(pg_temp.rid('partial-trip'),(select v from rv where k='partial-draft'),gen_random_uuid(),(select v->>'digest'from rv where k='partial-review'),(select(v->>'expiresAt')::timestamptz from rv where k='partial-review'),true));
select is((public.read_trip_contra_snapshot(pg_temp.rid('partial-trip'),'custom','6000','MYR')->'pairs'->0->'display'->>'netMinor')::bigint,3000::bigint,'native partial valuation remains approximately MYR3000 after posting');
-- Inject outbox failure: cash, native contra, history and notices all roll back.
insert into rv values('atomic-draft',pg_temp.netdraft(jsonb_build_array(pg_temp.rpayment('atomic',5,1,60000,4,1000))));
insert into rv values('atomic-review',public.preview_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='atomic-draft')));
reset role;
create function pg_temp.contra_fail()returns trigger language plpgsql as $$begin raise exception using message='contra_atomic_probe',errcode='P0001';end$$;
create trigger contra_fail before insert on private.creator_outbox for each row execute function pg_temp.contra_fail();
create temp table counts as select(select count(*)from public.settlement_payments)payments,(select count(*)from public.financial_events)events,(select count(*)from private.creator_outbox)notices;grant select on counts to authenticated;
set local role authenticated;
select throws_ok($$select public.record_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='atomic-draft'),gen_random_uuid(),(select v->>'digest'from rv where k='atomic-review'),(select(v->>'expiresAt')::timestamptz from rv where k='atomic-review'),true)$$,'P0001','contra_atomic_probe','outbox failure aborts entire net settlement');
reset role;
select is((select count(*)from public.settlement_payments),(select payments from counts),'failed transaction leaves no cash or native reductions');
select is((select count(*)from public.financial_events),(select events from counts),'failed transaction leaves no financial history');
select is((select count(*)from private.creator_outbox),(select notices from counts),'failed transaction leaves no notices');
select is((pg_temp.netpair(1,4)->'display'->>'netMinor')::bigint,15165::bigint,'failed transaction leaves original net cap');

drop trigger contra_fail on private.creator_outbox;
-- Full payment clears both original directions as non-cash coverage, cash once.
set local role authenticated;
insert into rv values('full-snapshot',public.read_trip_contra_snapshot(pg_temp.rid('partial-trip'),'custom','6000','MYR'));
insert into rv values('full-draft',(select v||jsonb_build_object('contraSnapshot',jsonb_build_object('revision',(select v->>'revision'from rv where k='full-snapshot'),'displayCurrency','MYR'),'payments',jsonb_build_array(pg_temp.rpayment('full',2,1,180000)))from rv where k='partial-draft'));
insert into rv values('full-review',public.preview_trip_creator_settlement(pg_temp.rid('partial-trip'),(select v from rv where k='full-draft')));
insert into rv values('full-record',public.record_trip_creator_settlement(pg_temp.rid('partial-trip'),(select v from rv where k='full-draft'),gen_random_uuid(),(select v->>'digest'from rv where k='full-review'),(select(v->>'expiresAt')::timestamptz from rv where k='full-review'),true));
select is(jsonb_array_length(public.read_trip_contra_snapshot(pg_temp.rid('partial-trip'),'custom','6000','MYR')->'pairs'),0,'full exact net cash clears both native directions');
select throws_ok($$select public.reverse_trip_creator_settlement((select(v->>'id')::uuid from rv where k='partial-record'),gen_random_uuid(),1,'Has later coverage')$$,'P0001','routed_reversal_dependency','earlier partial cannot be reversed across later net coverage');
select public.reverse_trip_creator_settlement((select(v->>'id')::uuid from rv where k='full-record'),gen_random_uuid(),1,'Undo full');
select is((public.read_trip_contra_snapshot(pg_temp.rid('partial-trip'),'custom','6000','MYR')->'pairs'->0->'display'->>'netMinor')::bigint,3000::bigint,'latest full reversal restores original partial standing');
-- A reverse manual payment has no winning net edge; no raw opposite debt leaks.
insert into rv values('reverse-draft',pg_temp.netdraft(jsonb_build_array(pg_temp.rpayment('wrong',1,2,100,null,null,'MYR'))));
insert into rv values('reverse-review',public.preview_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='reverse-draft')));
select is((select v->>'digest'from rv where k='reverse-review'),null,'manual raw reverse direction cannot authorize payment');
select throws_ok($$select public.preview_trip_creator_settlement(pg_temp.rid('trip'),(select v||'{"edgeBasis":"gross"}'from rv where k='reverse-draft'))$$,'P0001','invalid_contra_snapshot','client cannot request gross reinterpretation of net data');
-- Synthetic pending hold through the original tables: pending is not paid.
reset role;
insert into public.settlement_payments(client_request_id,scope,space_id,debtor_participant_id,currency,amount_minor,payment_date,status,cash_tracking_required)
values(gen_random_uuid(),'space',pg_temp.rid('partial-trip'),pg_temp.rid('u2'),'VND',60000,current_date,'pending',false)returning id as pending_payment \gset
insert into public.settlement_allocations(settlement_payment_id,creditor_participant_id,amount_minor,state)values(:'pending_payment',pg_temp.rid('u1'),60000,'pending');
set local role authenticated;
select is((public.read_trip_contra_snapshot(pg_temp.rid('partial-trip'),'custom','6000','MYR')->'pairs'->0->'display'->>'netMinor')::bigint,3000::bigint,'pending holds leave net standing unchanged');
select is((public.read_trip_contra_snapshot(pg_temp.rid('partial-trip'),'custom','6000','MYR')->'pairs'->0->>'availableMinor')::bigint,0::bigint,'pending holds block new capacity without inventing reverse debt');
select is(public.read_trip_contra_snapshot(pg_temp.rid('partial-trip'),'custom','6000','MYR')->'pairs'->0->>'payer',pg_temp.rid('u2')::text,'pending never flips payer');


-- Actual VND uses its existing native unit across recipients; no coarse-display rounding.
set local role authenticated;
insert into rr values('round-trip',public.create_space('trip','Two actual VND recipients',null,null,'MYR'));
reset role;
insert into public.space_members(space_id,participant_id,role)select pg_temp.rid('round-trip'),pg_temp.rid('u'||n),'view'from unnest(array[2,3,4])n;
set local role authenticated;
select pg_temp.rbill(pg_temp.rid('round-trip'),2,1,280000),pg_temp.rbill(pg_temp.rid('round-trip'),3,2,400000),pg_temp.rbill(pg_temp.rid('round-trip'),4,2,100000),pg_temp.rbill(pg_temp.rid('round-trip'),3,1,250000),pg_temp.rbill(pg_temp.rid('round-trip'),4,1,20000);
insert into rv values('round-snapshot',public.read_trip_contra_snapshot(pg_temp.rid('round-trip'),'custom','6000','MYR'));
insert into rv values('round-draft',pg_temp.rdraft(jsonb_build_array((pg_temp.rpayment('a-dav',1,3,400000,2,3333)||jsonb_build_object('via',jsonb_build_object('person',pg_temp.rid('u2'),'minor',200000))),(pg_temp.rpayment('b-alex',1,4,100000,2,1334)||jsonb_build_object('via',jsonb_build_object('person',pg_temp.rid('u2'),'minor',80000)))))||jsonb_build_object('edgeBasis','net','contraSnapshot',jsonb_build_object('revision',(select v->>'revision'from rv where k='round-snapshot'),'displayCurrency','MYR'),'occurredAt',now(),'note','','ownAccountLinks','[]'::jsonb));
insert into rv values('round-review',public.preview_trip_creator_settlement(pg_temp.rid('round-trip'),(select v from rv where k='round-draft')));
select is(jsonb_array_length((select v->'plan'->'issues'from rv where k='round-review')),0,'legitimate two-payee VND partial is not blocked by a rounding cent');
select is((select sum((l->>'valueMinor')::bigint)::bigint from rv cross join lateral jsonb_array_elements(v->'plan'->'lines')l where k='round-review'),500000::bigint,'server keeps exact combined native cash without per-row MYR rounding');
insert into rv values('round-record',public.record_trip_creator_settlement(pg_temp.rid('round-trip'),(select v from rv where k='round-draft'),gen_random_uuid(),(select v->>'digest'from rv where k='round-review'),(select(v->>'expiresAt')::timestamptz from rv where k='round-review'),true));
reset role;
select is((select sum(p.amount_minor)::bigint from public.settlement_payments p join private.creator_receipts r on r.payment_id=p.id where r.record_id=(select(v->>'id')::uuid from rv where k='round-record')and r.kind='cash'),500000::bigint,'original actual VND cash total is unchanged by quote reconciliation');


set local role authenticated;
insert into rr values('full-two-trip',public.create_space('trip','Two native full payments',null,null,'MYR'));
reset role;
insert into public.space_members(space_id,participant_id,role)select pg_temp.rid('full-two-trip'),pg_temp.rid('u'||n),'view'from unnest(array[2,3])n;
set local role authenticated;
select pg_temp.rbill(pg_temp.rid('full-two-trip'),2,1,400000),pg_temp.rbill(pg_temp.rid('full-two-trip'),3,1,100000);
insert into rv values('two-snapshot',public.read_trip_contra_snapshot(pg_temp.rid('full-two-trip'),'custom','6000','MYR'));
insert into rv values('two-draft',pg_temp.rdraft(jsonb_build_array(pg_temp.rpayment('full-a',1,2,400000),pg_temp.rpayment('full-b',1,3,100000)))||jsonb_build_object('edgeBasis','net','contraSnapshot',jsonb_build_object('revision',(select v->>'revision'from rv where k='two-snapshot'),'displayCurrency','MYR'),'occurredAt',now(),'note','','ownAccountLinks','[]'::jsonb));
insert into rv values('two-review',public.preview_trip_creator_settlement(pg_temp.rid('full-two-trip'),(select v from rv where k='two-draft')));
select is(jsonb_array_length((select v->'plan'->'issues'from rv where k='two-review')),0,'two exact native full payments can close independently');
insert into rv values('two-record',public.record_trip_creator_settlement(pg_temp.rid('full-two-trip'),(select v from rv where k='two-draft'),gen_random_uuid(),(select v->>'digest'from rv where k='two-review'),(select(v->>'expiresAt')::timestamptz from rv where k='two-review'),true));
select is(jsonb_array_length(public.read_trip_contra_snapshot(pg_temp.rid('full-two-trip'),'custom','6000','MYR')->'pairs'),0,'full native cash leaves no invented display-rounding debt');

select * from finish();rollback;
