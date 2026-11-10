-- Routed payments compose existing native debt readers, holds, cash legs and reversals.
-- Proposals do not reserve money. All related legacy writers are excluded by the
-- ORIGINAL table-lock protocol, not a new isolated proposal-table lock.
begin;
create table private.trip_routed_proposals(
 id uuid primary key default gen_random_uuid(), space_id uuid not null references public.spaces(id),
 author uuid not null references public.participants(id), request_id uuid not null,
 draft jsonb not null, plan jsonb not null, digest text not null, expires_at timestamptz not null,
 status text not null default 'pending' check(status in('pending','posted','stale','declined','cancelled','reversed')),
 version integer not null default 1, after_state jsonb, created_at timestamptz not null default now(),
 posted_at timestamptz,reversed_at timestamptz,unique(author,request_id)
);
create table private.trip_routed_approvals(
 proposal uuid not null references private.trip_routed_proposals(id), actor uuid not null references public.participants(id),
 decision text check(decision in('approve','decline')), accounts jsonb, authorizations jsonb,
 primary key(proposal,actor)
);
create table private.trip_routed_receipts(
 proposal uuid not null references private.trip_routed_proposals(id),payment uuid not null unique references public.settlement_payments(id),
 kind text not null check(kind in('cash','coverage')),line_id text,primary key(proposal,payment)
);
alter table private.trip_routed_proposals enable row level security;
alter table private.trip_routed_approvals enable row level security;
alter table private.trip_routed_receipts enable row level security;
revoke all on private.trip_routed_proposals,private.trip_routed_approvals,private.trip_routed_receipts from public,anon,authenticated;

-- Existing half-up rational rounding, expressed in the finest supported actual
-- cash unit (VND). MYR is always integer cents. No display estimate is posted.
create function private.routed_value(minor bigint,code text,n numeric,d numeric)
returns bigint language plpgsql immutable set search_path='' as $$
#variable_conflict use_variable
begin
 if minor<0 or minor>9007199254740991 or code not in('VND','MYR') or n<=0 or d<=0 then raise exception using message='invalid_amount',errcode='P0001';end if;
 if code='VND' then return minor;end if;
 return private.fx_round_div(minor::numeric*n,100*d);
end $$;

create function private.routed_edge(trip uuid,debtor uuid,creditor uuid,n numeric,d numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare code text;a bigint;b bigint;value bigint:=0;native jsonb:='[]'::jsonb;
begin
 for code in select distinct e.currency from public.expenses e where e.space_id=trip and e.scope='space'and e.status='active'order by e.currency loop
  a:=private.space_signed_outstanding(trip,debtor,creditor,code)-private.pending_pair_minor(trip,debtor,creditor,code);
  b:=private.space_signed_outstanding(trip,creditor,debtor,code)-private.pending_pair_minor(trip,creditor,debtor,code);
  if (a>0 or b>0)and code not in('MYR','VND')then raise exception using message='routed_native_currency_unsupported',errcode='P0001';end if;
  if a>0 then native:=native||jsonb_build_array(jsonb_build_object('from',debtor,'to',creditor,'currency',code,'minor',a));value:=value+private.routed_value(a,code,n,d);end if;
  if b>0 then native:=native||jsonb_build_array(jsonb_build_object('from',creditor,'to',debtor,'currency',code,'minor',b));value:=value-private.routed_value(b,code,n,d);end if;
 end loop;
 return jsonb_build_object('id',debtor::text||':'||creditor::text,'from',debtor,'to',creditor,'minor',greatest(value,0),'native',native,'expenses',private.fx_pair_expense_versions(trip,debtor,creditor));
end $$;

create function private.routed_build(actor uuid,trip uuid,draft jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare payments jsonb:=draft->'payments';p jsonb;line jsonb;e jsonb;leg jsonb;member uuid;sender uuid;receiver uuid;via uuid;k text;
 edges jsonb:='{}'::jsonb;reserved jsonb:='{}'::jsonb;ids jsonb:='{}'::jsonb;lefts jsonb:='{}'::jsonb;totals jsonb:='{}'::jsonb;lines jsonb:='[]'::jsonb;next_lines jsonb:='[]'::jsonb;issues jsonb:='[]'::jsonb;native jsonb:='[]'::jsonb;remaining jsonb:='[]'::jsonb;actors jsonb:='[]'::jsonb;sources jsonb:='[]'::jsonb;
 amount bigint;value bigint;route bigint;direct bigint;unapplied bigint;cap bigint;covered bigint;total bigint;net bigint;
 n numeric;d numeric;snapshot uuid;rates jsonb;quote jsonb;mode text:=draft->>'rateMode';
begin
 if actor is null or private.space_role(trip,actor)is null then raise exception using message='settlement_participant_denied',errcode='P0001';end if;
 perform 1 from public.spaces s where s.id=trip and s.type='trip'and s.status<>'voided'for share;
 if not found then raise exception using message='settlement_participant_denied',errcode='P0001';end if;
 if mode is null or mode not in('system','custom')or jsonb_typeof(payments)is distinct from'array'or jsonb_array_length(payments)not between 1 and 50 then raise exception using message='invalid_amount',errcode='P0001';end if;
 if mode='custom' then
  if coalesce(draft->>'vndPerMyr','')!~'^[0-9]{1,12}(\.[0-9]{1,12})?$'or(draft->>'vndPerMyr')::numeric<=0 then raise exception using message='invalid_rate',errcode='P0001';end if;
  n:=(draft->>'vndPerMyr')::numeric;d:=1;quote:=jsonb_build_object('numerator',n::text,'denominator','1','source','custom','provider','Custom');
 else
  select r.snapshot_id,s.rates into snapshot,rates from tabby_fx.refresh_state r join tabby_fx.snapshots s on s.id=r.snapshot_id where r.singleton for share of r,s;
  n:=(rates->'VND'->>'denominator')::numeric;d:=(rates->'VND'->>'numerator')::numeric;
  if exists(select 1 from jsonb_array_elements(payments)q where q->>'tenderCurrency'='MYR')or exists(select 1 from public.expenses x where x.space_id=trip and x.scope='space'and x.status='active'and x.currency='MYR')then
   if n is null or d is null or n<=0 or d<=0 or rates->'VND'->>'provider'is null or rates->'VND'->>'rateDate'is null then raise exception using message='fx_rate_unavailable',errcode='P0001';end if;
   if snapshot is distinct from nullif(draft->>'snapshotId','')::uuid then raise exception using message='quote_changed',errcode='P0001';end if;
   quote:=jsonb_build_object('numerator',n::text,'denominator',d::text,'source','system','provider',rates->'VND'->>'provider','rateDate',rates->'VND'->>'rateDate','snapshotId',snapshot);
  else n:=1;d:=1;quote:=jsonb_build_object('numerator','1','denominator','1','source','identity');end if;
 end if;
 for p in select q from jsonb_array_elements(payments)q order by q->>'id'loop
  sender:=(p->>'payer')::uuid;receiver:=(p->>'recipient')::uuid;via:=nullif(p->'via'->>'person','')::uuid;
  if coalesce(p->>'id','')!~'^[A-Za-z0-9_-]{1,80}$'or ids ? (p->>'id')or sender is null or receiver is null or sender=receiver or actor not in(sender,receiver)or p->>'tenderCurrency'not in('MYR','VND')or p->>'method'not in('cash','bank_transfer')then raise exception using message='routed_participant_denied',errcode='P0001';end if;
  if (p->>'tenderCurrency')is null or(p->>'method')is null or coalesce(p->>'tenderMinor','')!~'^[0-9]{1,16}$'then raise exception using message='invalid_amount',errcode='P0001';end if;
  ids:=ids||jsonb_build_object(p->>'id',true);k:=sender::text||':'||receiver::text||':'||(p->>'tenderCurrency');
  if ids ? k then raise exception using message='duplicate_tender',errcode='P0001';end if;ids:=ids||jsonb_build_object(k,true);
  for member in select distinct x from unnest(array[sender,receiver,via])x where x is not null order by x loop
   perform 1 from public.space_members sm join public.participants pt on pt.id=sm.participant_id where sm.space_id=trip and sm.participant_id=member and sm.removed_at is null and pt.kind='account'for share of sm,pt;
   if not found then raise exception using message='routed_participant_denied',errcode='P0001';end if;
   if not actors @> jsonb_build_array(member)then actors:=actors||jsonb_build_array(member);end if;
  end loop;
  if via is not null and via in(sender,receiver)then raise exception using message='invalid_intermediary',errcode='P0001';end if;
  -- Load only the shared pairs used by this draft; unrelated pairs never enter DTOs.
  for e in select jsonb_build_object('from',sender,'to',receiver)union all select jsonb_build_object('from',sender,'to',via)where via is not null union all select jsonb_build_object('from',via,'to',receiver)where via is not null loop
   k:=(e->>'from')||':'||(e->>'to');
   if not edges ? k then
    e:=private.routed_edge(trip,(e->>'from')::uuid,(e->>'to')::uuid,n,d);edges:=edges||jsonb_build_object(k,e);lefts:=lefts||jsonb_build_object(k,e->'minor');
   end if;
  end loop;
  amount:=(p->>'tenderMinor')::bigint;if amount<=0 then raise exception using message='invalid_amount',errcode='P0001';end if;
  value:=private.routed_value(amount,p->>'tenderCurrency',n,d);route:=0;
  p:=jsonb_strip_nulls(jsonb_build_object('id',p->>'id','payer',sender,'recipient',receiver,'tenderCurrency',p->>'tenderCurrency','tenderMinor',amount,'method',p->>'method','via',case when via is not null then jsonb_build_object('person',via)||case when p->'via' ? 'minor' then jsonb_build_object('minor',p->'via'->'minor')else '{}'::jsonb end else null end));
  if value=0 then issues:=issues||jsonb_build_array(jsonb_build_object('code','ZERO_VALUE','paymentIds',jsonb_build_array(p->>'id')));end if;
  if via is not null then
   cap:=least(value,(edges->(sender::text||':'||via::text)->>'minor')::bigint,(edges->(via::text||':'||receiver::text)->>'minor')::bigint);
   if cap<=0 then issues:=issues||jsonb_build_array(jsonb_build_object('code','NO_OPEN_ROUTE','paymentIds',jsonb_build_array(p->>'id')));end if;
   if p->'via' ? 'minor'and coalesce(p->'via'->>'minor','')!~'^[0-9]{1,16}$'then raise exception using message='invalid_amount',errcode='P0001';end if;
   route:=coalesce((p->'via'->>'minor')::bigint,cap);
   if route<0 or route>value or(route=0 and cap>0)then raise exception using message='invalid_routed_amount',errcode='P0001';end if;
   for k in select sender::text||':'||via::text union all select via::text||':'||receiver::text loop
    reserved:=reserved||jsonb_build_object(k,coalesce((reserved->>k)::bigint,0)+route);
    totals:=totals||jsonb_build_object(k,coalesce(totals->k,'[]')||jsonb_build_array(p->>'id'));
   end loop;
  end if;
  lines:=lines||jsonb_build_array(jsonb_build_object('payment',p,'valueMinor',value,'viaMinor',route,'directMinor',0,'unappliedMinor',value-route));
 end loop;
 for k,total in select entry.key,entry.value::text::bigint from jsonb_each(reserved)entry loop
  cap:=(edges->k->>'minor')::bigint;
  if total>cap then issues:=issues||jsonb_build_array(jsonb_build_object('code','SHARED_LIMIT','paymentIds',totals->k,'capacityMinor',cap));end if;
 end loop;
 if jsonb_array_length(issues)=0 then
  for k,total in select entry.key,entry.value::text::bigint from jsonb_each(reserved)entry loop lefts:=lefts||jsonb_build_object(k,(lefts->>k)::bigint-total);end loop;
  for line in select q from jsonb_array_elements(lines)q loop
   p:=line->'payment';k:=(p->>'payer')||':'||(p->>'recipient');unapplied:=(line->>'unappliedMinor')::bigint;
   direct:=least(unapplied,(lefts->>k)::bigint);lefts:=lefts||jsonb_build_object(k,(lefts->>k)::bigint-direct);
   if direct>0 then totals:=totals||jsonb_build_object(k,coalesce(totals->k,'[]')||jsonb_build_array(p->>'id'));end if;
   if unapplied>direct then issues:=issues||jsonb_build_array(jsonb_build_object('code','UNAPPLIED_CASH','paymentIds',jsonb_build_array(p->>'id')));end if;
   next_lines:=next_lines||jsonb_build_array(line||jsonb_build_object('directMinor',direct,'unappliedMinor',unapplied-direct));
  end loop;lines:=next_lines;
 end if;
 for k,e in select entry.key,entry.value from jsonb_each(edges)entry order by entry.key loop
  total:=(e->>'minor')::bigint-(lefts->>k)::bigint;net:=0;
  for leg in select q from jsonb_array_elements(e->'native')q loop
   covered:=case when total=0 then 0 else least((leg->>'minor')::bigint,private.fx_round_div((leg->>'minor')::numeric*total,(e->>'minor')::numeric))end;
   if covered>0 then native:=native||jsonb_build_array(jsonb_build_object('edgeId',k,'from',leg->'from','to',leg->'to','currency',leg->'currency','minor',covered));end if;
   net:=net+case when leg->>'from'=e->>'from'then 1 else -1 end*private.routed_value(covered,leg->>'currency',n,d);
   remaining:=remaining||jsonb_build_array(jsonb_build_object('id',k||':'||(leg->>'currency')||':'||(leg->>'from'),'from',leg->'from','to',leg->'to','currency',leg->'currency','minor',(leg->>'minor')::bigint-covered));
  end loop;
  -- No unexplained tolerance: native coverage must explain the paired value.
  if total>0 and net<>total then issues:=issues||jsonb_build_array(jsonb_build_object('code','NATIVE_PRECISION','paymentIds',totals->k));end if;
  sources:=sources||jsonb_build_array(e);
 end loop;
 if jsonb_array_length(issues)>0 then native:='[]'::jsonb;remaining:='[]'::jsonb;select jsonb_agg(q||jsonb_build_object('viaMinor',0,'directMinor',0,'unappliedMinor',q->'valueMinor'))into lines from jsonb_array_elements(lines)q;for e in select entry.value from jsonb_each(edges)entry loop remaining:=remaining||e->'native';end loop;end if;
 return jsonb_build_object('ledgerCurrency','VND','lines',lines,'issues',issues,'remaining',remaining,'rate',quote,'native',native,'sources',sources,'actors',actors);
end $$;

create function private.routed_public_plan(plan jsonb)
returns jsonb language sql immutable set search_path='' as $$select(plan-'native'-'sources'-'actors')||jsonb_build_object('coverage',(select coalesce(jsonb_agg(q-'edgeId'),'[]')from jsonb_array_elements(plan->'native')q))$$;
create function private.routed_digest(trip uuid,actor uuid,draft jsonb,plan jsonb,expires timestamptz)
returns text language sql immutable set search_path='' as $$select encode(extensions.digest(jsonb_build_object('trip',trip,'actor',actor,'draft',draft,'plan',plan,'expires',expires)::text,'sha256'),'hex')$$;

create function public.preview_trip_routed_settlement(target_space_id uuid,draft jsonb,expires_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();plan jsonb;expiry timestamptz:=coalesce(expires_at,now()+interval'10 minutes');
begin
 perform private.lock_collect_pay_balance();
 if expiry<=clock_timestamp()or expiry>clock_timestamp()+interval'10 minutes'then raise exception using message='quote_expired',errcode='P0001';end if;
 plan:=private.routed_build(actor,target_space_id,draft);
 return jsonb_build_object('plan',private.routed_public_plan(plan),'expiresAt',expiry,'digest',case when jsonb_array_length(plan->'issues')=0 then private.routed_digest(target_space_id,actor,draft,plan,expiry)else null end);
end $$;

create function private.routed_view(target uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();p private.trip_routed_proposals%rowtype;required integer;approved integer;
begin
 select * into p from private.trip_routed_proposals where id=target;
 if p.id is null or private.space_role(p.space_id,actor)is null or not exists(select 1 from private.trip_routed_approvals a where a.proposal=p.id and a.actor=actor)then raise exception using message='settlement_participant_denied',errcode='P0001';end if;
 select count(*),count(*)filter(where a.decision='approve')into required,approved from private.trip_routed_approvals a where a.proposal=p.id;
 return jsonb_build_object('id',p.id,'tripId',p.space_id,'version',p.version,'status',p.status,'createdAt',p.created_at,'postedAt',p.posted_at,'reversedAt',p.reversed_at,'plan',private.routed_public_plan(p.plan),'approvedCount',approved,'requiredCount',required,'isAuthor',actor=p.author,'needsDecision',p.status='pending'and exists(select 1 from private.trip_routed_approvals a where a.proposal=p.id and a.actor=actor and a.decision is null),'needsAccounts',(select coalesce(jsonb_agg(jsonb_build_object('lineId',q->'payment'->>'id','role',case when q->'payment'->>'payer'=actor::text then'payer'else'receiver'end,'currency',q->'payment'->>'tenderCurrency')),'[]')from jsonb_array_elements(p.plan->'lines')q where actor::text in(q->'payment'->>'payer',q->'payment'->>'recipient')));
end $$;

create function public.submit_trip_routed_settlement(target_space_id uuid,draft jsonb,request_id uuid,reviewed_digest text,expires_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();receipt jsonb;plan jsonb;pid uuid;member jsonb;
begin
 receipt:=private.begin_money_operation(actor,request_id,'trip_routed_submit',jsonb_build_object('trip',target_space_id,'draft',draft,'digest',reviewed_digest,'expires',expires_at));
 if receipt is not null then return private.routed_view((receipt->>'proposalId')::uuid);end if;
 perform private.lock_collect_pay_balance();
 if expires_at is null or expires_at<=clock_timestamp()or expires_at>clock_timestamp()+interval'10 minutes'then raise exception using message='quote_expired',errcode='P0001';end if;
 plan:=private.routed_build(actor,target_space_id,draft);
 if jsonb_array_length(plan->'issues')>0 then raise exception using message='invalid_routed_plan',errcode='P0001';end if;
 if reviewed_digest is distinct from private.routed_digest(target_space_id,actor,draft,plan,expires_at)then raise exception using message='quote_changed',errcode='P0001';end if;
 insert into private.trip_routed_proposals(space_id,author,request_id,draft,plan,digest,expires_at)values(target_space_id,actor,request_id,draft,plan,reviewed_digest,expires_at)returning id into pid;
 for member in select q from jsonb_array_elements(plan->'actors')q loop insert into private.trip_routed_approvals(proposal,actor)values(pid,(member#>>'{}')::uuid);end loop;
 perform private.finish_money_operation(actor,request_id,jsonb_build_object('proposalId',pid));
 return private.routed_view(pid);
end $$;

-- A single posting boundary. Never compose browser-side calls to single-pay RPCs.
create function private.post_routed_proposal(target uuid)
returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p private.trip_routed_proposals%rowtype;line jsonb;leg jsonb;role text;owner uuid;account uuid;pid uuid;aid uuid;cash_leg uuid;auth jsonb;saved jsonb;states jsonb:='[]'::jsonb;e jsonb;n numeric;d numeric;
begin
 select * into p from private.trip_routed_proposals where id=target;
 -- Validate EVERY saved owner authorization before the first cash write.
 for line in select q from jsonb_array_elements(p.plan->'lines')q loop
  for role,owner in select'payer',(line->'payment'->>'payer')::uuid union all select'receiver',(line->'payment'->>'recipient')::uuid loop
   select a.authorizations->((line->'payment'->>'id')||':'||role)into saved from private.trip_routed_approvals a where a.proposal=p.id and a.actor=owner and a.decision='approve';
   auth:=private.trip_batch_account(owner,(saved->>'id')::uuid,line->'payment'->>'tenderCurrency');
   if saved is distinct from auth then raise exception using message='routed_account_changed',errcode='P0001';end if;
  end loop;
 end loop;
 for line in select q from jsonb_array_elements(p.plan->'lines')q loop
  insert into public.settlement_payments(client_request_id,scope,space_id,debtor_participant_id,currency,amount_minor,payment_date,status,note,fx_cash_only,cash_tracking_required)
   values(private.money_child_request(p.request_id,'routed:cash:'||(line->'payment'->>'id')),'space',p.space_id,(line->'payment'->>'payer')::uuid,line->'payment'->>'tenderCurrency',(line->'payment'->>'tenderMinor')::bigint,current_date,'pending','fx-cash',true,true)returning id into pid;
  insert into public.settlement_allocations(settlement_payment_id,creditor_participant_id,amount_minor,state)values(pid,(line->'payment'->>'recipient')::uuid,(line->'payment'->>'tenderMinor')::bigint,'pending')returning id into aid;
  for role,owner in select'payer',(line->'payment'->>'payer')::uuid union all select'receiver',(line->'payment'->>'recipient')::uuid loop
   select(a.accounts->>((line->'payment'->>'id')||':'||role))::uuid into account from private.trip_routed_approvals a where a.proposal=p.id and a.actor=owner;
   insert into public.personal_settlement_cash_legs(owner_participant_id,client_request_id,payload_fingerprint,settlement_payment_id,settlement_allocation_id,role,account_id,cash_amount_minor,account_currency,shared_amount_minor,gift_extra_minor,status)
    values(owner,private.money_child_request(p.request_id,'routed:'||(line->'payment'->>'id')||':'||role),private.personal_payload_fingerprint(jsonb_build_object('allocation_id',aid,'role',role,'account_id',account,'cash_amount_minor',line->'payment'->'tenderMinor','account_currency',line->'payment'->>'tenderCurrency','shared_amount_minor',line->'payment'->'tenderMinor','gift_extra_minor',0)),pid,aid,role,account,(line->'payment'->>'tenderMinor')::bigint,line->'payment'->>'tenderCurrency',(line->'payment'->>'tenderMinor')::bigint,0,'pending')returning id into cash_leg;
   perform private.post_personal_settlement_cash_leg(cash_leg);
  end loop;
  update public.settlement_allocations set state='accepted',responded_at=now()where id=aid;
  update public.settlement_payments set status='confirmed',version=version+1 where id=pid;
  insert into private.trip_routed_receipts values(p.id,pid,'cash',line->'payment'->>'id');
  insert into public.financial_events(actor_participant_id,settlement_payment_id,event_type,safe_diff)values(public.current_participant_id(),pid,'settlement.routed_cash_posted',jsonb_build_object('proposal_id',p.id,'line_id',line->'payment'->>'id','method',line->'payment'->>'method'));
 end loop;
 for leg in select q from jsonb_array_elements(p.plan->'native')q loop
  insert into public.settlement_payments(client_request_id,scope,space_id,debtor_participant_id,currency,amount_minor,payment_date,status,note,fx_cash_only,cash_tracking_required)
   values(private.money_child_request(p.request_id,'routed:coverage:'||(leg->>'edgeId')||':'||(leg->>'currency')||':'||(leg->>'from')),'space',p.space_id,(leg->>'from')::uuid,leg->>'currency',(leg->>'minor')::bigint,current_date,'confirmed','fx-coverage',false,false)returning id into pid;
  insert into public.settlement_allocations(settlement_payment_id,creditor_participant_id,amount_minor,state,responded_at)values(pid,(leg->>'to')::uuid,(leg->>'minor')::bigint,'accepted',now());
  insert into private.trip_routed_receipts values(p.id,pid,'coverage',null);
  insert into public.financial_events(actor_participant_id,settlement_payment_id,event_type,safe_diff)values(public.current_participant_id(),pid,'settlement.routed_coverage_posted',jsonb_build_object('proposal_id',p.id,'currency',leg->>'currency','minor',leg->'minor'));
 end loop;
 n:=(p.plan->'rate'->>'numerator')::numeric;d:=(p.plan->'rate'->>'denominator')::numeric;
 for e in select q from jsonb_array_elements(p.plan->'sources')q loop states:=states||jsonb_build_array(private.routed_edge(p.space_id,(e->>'from')::uuid,(e->>'to')::uuid,n,d));end loop;
 update private.trip_routed_proposals set status='posted',posted_at=now(),version=version+1,after_state=states where id=p.id;
end $$;

create function public.decide_trip_routed_settlement(proposal_id uuid,decision text,expected_version integer,accounts jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();p private.trip_routed_proposals%rowtype;a private.trip_routed_approvals%rowtype;line jsonb;key text;role text;auths jsonb:='{}'::jsonb;chosen jsonb:='{}'::jsonb;latest jsonb;stale boolean:=false;
begin
 perform private.lock_collect_pay_balance();select * into p from private.trip_routed_proposals where id=proposal_id for update;
 if p.id is null or private.space_role(p.space_id,actor)is null or decision is null or decision not in('approve','decline','cancel')then raise exception using message='settlement_participant_denied',errcode='P0001';end if;
 select * into a from private.trip_routed_approvals q where q.proposal=p.id and q.actor=actor;
 if a.actor is null or(decision='cancel'and actor<>p.author)then raise exception using message='settlement_participant_denied',errcode='P0001';end if;
 if p.status<>'pending'then return private.routed_view(p.id);end if;
 if decision='approve'and a.decision='approve'then
  if a.accounts is distinct from accounts then raise exception using message='idempotency_conflict',errcode='P0001';end if;
  return private.routed_view(p.id);
 end if;
 if p.version is distinct from expected_version then raise exception using message='version_conflict',errcode='P0001';end if;
 if decision in('decline','cancel')then
  if decision='decline'then update private.trip_routed_approvals set decision='decline'where proposal=p.id and trip_routed_approvals.actor=actor;end if;
  update private.trip_routed_proposals set status=case when decision='decline'then'declined'else'cancelled'end,version=version+1 where id=p.id;return private.routed_view(p.id);
 end if;
 if jsonb_typeof(accounts)is distinct from'object'then raise exception using message='settlement_cash_account_invalid',errcode='P0001';end if;
 for line in select q from jsonb_array_elements(p.plan->'lines')q where actor::text in(q->'payment'->>'payer',q->'payment'->>'recipient')loop
  role:=case when line->'payment'->>'payer'=actor::text then'payer'else'receiver'end;key:=(line->'payment'->>'id')||':'||role;
  auths:=auths||jsonb_build_object(key,private.trip_batch_account(actor,nullif(accounts->>key,'')::uuid,line->'payment'->>'tenderCurrency'));chosen:=chosen||jsonb_build_object(key,accounts->key);
 end loop;
 if chosen is distinct from accounts then raise exception using message='settlement_cash_account_invalid',errcode='P0001';end if;
 update private.trip_routed_approvals set decision='approve',accounts=chosen,authorizations=auths where proposal=p.id and trip_routed_approvals.actor=actor;
 if not exists(select 1 from private.trip_routed_approvals q where q.proposal=p.id and q.decision is distinct from'approve')then
  begin
   latest:=private.routed_build(p.author,p.space_id,p.draft);
   stale:=p.expires_at<=clock_timestamp()or latest is distinct from p.plan;
  exception when sqlstate 'P0001' then stale:=true;end;
  if stale then update private.trip_routed_proposals set status='stale',version=version+1 where id=p.id;
  else perform private.post_routed_proposal(p.id);end if;
 else update private.trip_routed_proposals set version=version+1 where id=p.id;end if;
 return private.routed_view(p.id);
end $$;

create function public.read_trip_routed_settlements(target_space_id uuid,request_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();p record;rows jsonb:='[]'::jsonb;
begin
 if private.space_role(target_space_id,actor)is null then raise exception using message='settlement_participant_denied',errcode='P0001';end if;
 for p in select q.id from private.trip_routed_proposals q join private.trip_routed_approvals a on a.proposal=q.id and a.actor=actor where q.space_id=target_space_id and(request_id is null or(q.author=actor and q.request_id=read_trip_routed_settlements.request_id))order by q.created_at desc limit 100 loop rows:=rows||jsonb_build_array(private.routed_view(p.id));end loop;
 return rows;
end $$;

create function public.reverse_trip_routed_settlement(proposal_id uuid,request_id uuid,expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();p private.trip_routed_proposals%rowtype;receipt jsonb;states jsonb:='[]'::jsonb;e jsonb;allocation record;previous text:=current_setting('tabby.fx_bundle_reversal',true);
begin
 receipt:=private.begin_money_operation(actor,request_id,'trip_routed_reverse',jsonb_build_object('proposal',proposal_id,'version',expected_version));
 perform private.lock_collect_pay_balance();select * into p from private.trip_routed_proposals where id=proposal_id for update;
 if p.id is null or private.space_role(p.space_id,actor)is null or not exists(select 1 from private.trip_routed_approvals a where a.proposal=p.id and a.actor=actor)then raise exception using message='settlement_participant_denied',errcode='P0001';end if;
 if receipt is not null then return private.routed_view(p.id);end if;
 if p.status='reversed'then perform private.finish_money_operation(actor,request_id,jsonb_build_object('proposalId',p.id));return private.routed_view(p.id);end if;
 if p.status<>'posted'or p.version<>expected_version then raise exception using message='version_conflict',errcode='P0001';end if;
 for e in select q from jsonb_array_elements(p.plan->'sources')q loop states:=states||jsonb_build_array(private.routed_edge(p.space_id,(e->>'from')::uuid,(e->>'to')::uuid,(p.plan->'rate'->>'numerator')::numeric,(p.plan->'rate'->>'denominator')::numeric));end loop;
 if states is distinct from p.after_state then raise exception using message='routed_reversal_dependency',errcode='P0001';end if;
 perform set_config('tabby.fx_bundle_reversal','on',true);
 for allocation in select a.* from private.trip_routed_receipts r join public.settlement_allocations a on a.settlement_payment_id=r.payment where r.proposal=p.id order by a.id loop
  insert into public.settlement_allocation_reversals(client_request_id,settlement_allocation_id,reversed_by,amount_minor,reason)values(private.money_child_request(request_id,allocation.id::text),allocation.id,actor,allocation.amount_minor,'routed-whole-reversal');perform public.recompute_settlement_status(allocation.settlement_payment_id);
  insert into public.financial_events(actor_participant_id,settlement_payment_id,event_type,safe_diff)values(actor,allocation.settlement_payment_id,'settlement.routed_reversed',jsonb_build_object('proposal_id',p.id));
 end loop;
 perform set_config('tabby.fx_bundle_reversal',coalesce(previous,''),true);
 update private.trip_routed_proposals set status='reversed',reversed_at=now(),version=version+1 where id=p.id;
 perform private.finish_money_operation(actor,request_id,jsonb_build_object('proposalId',p.id));return private.routed_view(p.id);
end $$;

-- No browser role can call calculators, inspect private snapshots/accounts or post.
revoke all on function private.routed_value(bigint,text,numeric,numeric),private.routed_edge(uuid,uuid,uuid,numeric,numeric),private.routed_build(uuid,uuid,jsonb),private.routed_public_plan(jsonb),private.routed_digest(uuid,uuid,jsonb,jsonb,timestamptz),private.routed_view(uuid),private.post_routed_proposal(uuid)from public,anon,authenticated;
revoke all on function public.preview_trip_routed_settlement(uuid,jsonb,timestamptz),public.submit_trip_routed_settlement(uuid,jsonb,uuid,text,timestamptz),public.decide_trip_routed_settlement(uuid,text,integer,jsonb),public.read_trip_routed_settlements(uuid,uuid),public.reverse_trip_routed_settlement(uuid,uuid,integer)from public,anon;
grant execute on function public.preview_trip_routed_settlement(uuid,jsonb,timestamptz),public.submit_trip_routed_settlement(uuid,jsonb,uuid,text,timestamptz),public.decide_trip_routed_settlement(uuid,text,integer,jsonb),public.read_trip_routed_settlements(uuid,uuid),public.reverse_trip_routed_settlement(uuid,uuid,integer)to authenticated;
notify pgrst,'reload schema';
commit;
