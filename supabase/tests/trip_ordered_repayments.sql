begin;
-- Serialize this single-session fixture with scheduled workers before seeding.
-- Production NOWAIT guards and separate real-session race tests stay unchanged.
set local lock_timeout='5s';
lock table public.expenses,public.expense_participations,public.payer_contributions,
 public.expense_shares,public.settlement_allocations,public.settlement_payments,
 public.settlement_allocation_reversals in exclusive mode;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',('f1111601-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'authenticated','authenticated','route-'||n||'@example.test','',now(),'{"provider":"email","providers":["email"]}','{"display_name":"Proxy fixture"}',now(),now()from generate_series(1,7)n;
create temp table rr(k text primary key,v uuid);
insert into rr select 'u'||n,p.id from generate_series(1,7)n join public.participants p on p.auth_user_id=('f1111601-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
grant all on rr to authenticated;
create function pg_temp.rid(k text)returns uuid language sql as $$select v from rr where rr.k=$1$$;
create function pg_temp.rclaim(n int)returns void language plpgsql as $$begin perform set_config('request.jwt.claims',jsonb_build_object('sub','f1111601-0000-4000-8000-'||lpad(n::text,12,'0'),'role','authenticated','is_anonymous',false)::text,true);end$$;
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
-- Native VND coverage: RM100 at 6000 VND/MYR, never inverse rounded MYR bills.
select pg_temp.rbill(pg_temp.rid('trip'),2,3,600000),pg_temp.rbill(pg_temp.rid('trip'),2,4,600000),pg_temp.rbill(pg_temp.rid('trip'),1,2,600000),pg_temp.rbill(pg_temp.rid('trip'),1,3,600000),pg_temp.rbill(pg_temp.rid('trip'),1,4,600000);
select is(public.read_trip_contra_snapshot(pg_temp.rid('trip'),'custom','6320.125','MYR')->'quote'->>'numerator','6320.125','authoritative custom quote retains SQL numeric decimal parts');
insert into rv values('ordered',pg_temp.netdraft(jsonb_build_array(pg_temp.rpayment('z-first',3,1,420000,2,7000),pg_temp.rpayment('a-second',4,1,300000,2,3000))));
insert into rv values('ordered-review',public.preview_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='ordered')));
select isnt((select v->>'digest'from rv where k='ordered-review'),null,'entry-order explicit 70/30 allocations authorize one batch');
select is((select (q->>'viaMinor')::bigint from rv,jsonb_array_elements(v->'plan'->'lines')q where k='ordered-review'and q->'payment'->>'id'='z-first'),420000::bigint,'first row retains RM70 through intermediary even when IDs sort differently');
select is((select (q->>'directMinor')::bigint from rv,jsonb_array_elements(v->'plan'->'lines')q where k='ordered-review'and q->'payment'->>'id'='a-second'),120000::bigint,'second row leaves RM20 as direct coverage');
insert into rv values('edited',pg_temp.netdraft(jsonb_build_array(pg_temp.rpayment('z-first',3,1,420000,2,6000),pg_temp.rpayment('a-second',4,1,300000,2,4000))));
insert into rv values('edited-review',public.preview_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='edited')));
select isnt((select v->>'digest'from rv where k='edited-review'),null,'earlier manual60 and later auto40 pass authoritative native review');
insert into rv values('conflict',pg_temp.netdraft(jsonb_build_array(pg_temp.rpayment('z-first',3,1,420000,2,6000),pg_temp.rpayment('a-second',4,1,300000,2,4500))));
insert into rv values('conflict-review',public.preview_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='conflict')));
select is((select v->>'digest'from rv where k='conflict-review'),null,'manual45 conflict cannot authorize partial batch');
select ok((select exists(select 1 from jsonb_array_elements(v->'plan'->'issues')q where q->>'code'='SHARED_LIMIT')from rv where k='conflict-review'),'server independently rejects shared downstream over-cap');
-- Later reviews supersede earlier quotes: obtain a fresh authoritative review.
update rv set v=pg_temp.netdraft(v->'payments')where k='ordered';
update rv set v=public.preview_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='ordered'))where k='ordered-review';
insert into rr values('request',gen_random_uuid());
insert into rv values('posted',public.record_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='ordered'),pg_temp.rid('request'),(select v->>'digest'from rv where k='ordered-review'),(select(v->>'expiresAt')::timestamptz from rv where k='ordered-review'),true));
select is((select v->>'status'from rv where k='posted'),'posted','ordered batch posts through existing atomic command');
select ok(pg_temp.netpair(1,2) is null,'fully covered intermediary debt is absent from outstanding snapshot');
select is((pg_temp.netpair(2,3)->>'netMinor')::bigint,180000::bigint,'first upstream reduced by actual RM70 coverage');
select is((pg_temp.netpair(2,4)->>'netMinor')::bigint,420000::bigint,'second upstream reduced by RM30 coverage');
select is((pg_temp.netpair(1,4)->>'netMinor')::bigint,480000::bigint,'second direct debt reduced by RM20 only');
select is(public.record_trip_creator_settlement(pg_temp.rid('trip'),(select v from rv where k='ordered'),pg_temp.rid('request'),(select v->>'digest'from rv where k='ordered-review'),(select(v->>'expiresAt')::timestamptz from rv where k='ordered-review'),true)->>'id',(select v->>'id'from rv where k='posted'),'same request retry returns one record');
select * from finish();
rollback;
