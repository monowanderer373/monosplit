-- Creator-authorized direct recording composes the original financial ledger.
-- Proxy grants never authorize another person's private account.
begin;
do $$begin if(select md5(prosrc)from pg_proc where oid='private.routed_build(uuid,uuid,jsonb)'::regprocedure)is distinct from '0d1c57ad9178434bb8614f61705dbbc9'then raise exception 'Unexpected routed planner baseline';end if;end$$;
create table private.creator_policies(
 space_id uuid primary key references public.spaces(id),version integer not null default 0
);
create table private.creator_grants(
 space_id uuid not null references public.spaces(id),participant_id uuid not null references public.participants(id),
 granted_by uuid not null references public.participants(id),enabled boolean not null,
 updated_at timestamptz not null default now(),primary key(space_id,participant_id)
);
create table private.creator_reviews(
 space_id uuid not null references public.spaces(id),actor uuid not null references public.participants(id),
 digest text,expires_at timestamptz not null,version integer not null default 1,primary key(space_id,actor)
);
create table private.creator_records(
 id uuid primary key default gen_random_uuid(),space_id uuid not null references public.spaces(id),
 recorded_by uuid not null references public.participants(id),recorded_by_name text not null,
 request_id uuid not null,reviewed_digest text not null,policy_hash text not null,
 occurred_at timestamptz not null,recorded_at timestamptz not null default now(),time_zone text not null,
 shared_note text not null check(length(shared_note)<=500),draft jsonb not null,plan jsonb not null,participant_names jsonb not null,
 status text not null default 'posted'check(status in('posted','reversed')),version integer not null default 1,
 after_state jsonb,reversed_at timestamptz,reversed_by uuid references public.participants(id),reverse_reason text,
 replacement_for uuid references private.creator_records(id),unique(recorded_by,request_id)
);
create index creator_records_trip_date on private.creator_records(space_id,recorded_at desc);
create table private.creator_receipts(
 record_id uuid not null references private.creator_records(id),payment_id uuid not null unique references public.settlement_payments(id),
 kind text not null check(kind in('cash','coverage')),line_id text,primary key(record_id,payment_id)
);
create table private.creator_corrections(
 id uuid primary key default gen_random_uuid(),record_id uuid not null references private.creator_records(id),
 requested_by uuid not null references public.participants(id),request_id uuid not null,reason text not null check(length(reason)between 1 and 500),
 state text not null default 'pending'check(state in('pending','resolved','dismissed')),version integer not null default 1,
 created_at timestamptz not null default now(),resolved_at timestamptz,resolved_by uuid references public.participants(id),
 resolution text,replacement_id uuid references private.creator_records(id),unique(requested_by,request_id)
);
create unique index creator_correction_pending on private.creator_corrections(record_id,requested_by)where state='pending';
create table private.creator_audit(
 event_key text primary key,space_id uuid not null references public.spaces(id),record_id uuid references private.creator_records(id),
 actor uuid references public.participants(id),kind text not null,safe_diff jsonb not null default '{}',created_at timestamptz not null default now()
);
create table private.creator_outbox(
 event_key text primary key,record_id uuid not null references private.creator_records(id),recipient_id uuid not null references public.participants(id),
 actor_id uuid references public.participants(id),actor_name text not null,kind text not null,
 correction_id uuid references private.creator_corrections(id),status text not null default 'pending'check(status in('pending','delivered','skipped')),
 attempts integer not null default 0,last_error text,created_at timestamptz not null default now(),delivered_at timestamptz
);
create index creator_outbox_pending on private.creator_outbox(created_at)where status='pending';
create table public.creator_settlement_notices(
 id uuid primary key default gen_random_uuid(),event_key text not null unique,record_id uuid not null references private.creator_records(id),
 recipient_id uuid not null references public.participants(id),actor_name text not null,kind text not null,
 correction_id uuid references private.creator_corrections(id),created_at timestamptz not null default now()
);
revoke all on public.creator_settlement_notices from public,anon,authenticated;
alter table public.creator_settlement_notices enable row level security;
do $$declare t text;begin
 foreach t in array array['creator_policies','creator_grants','creator_reviews','creator_records','creator_receipts','creator_corrections','creator_audit','creator_outbox']loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated',t);
 end loop;
end$$;

create function private.creator_can_record(trip uuid,actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.spaces s join public.space_members m on m.space_id=s.id and m.participant_id=actor and m.removed_at is null
 join public.participants p on p.id=actor and p.kind='account'
 where s.id=trip and s.type='trip'and s.status<>'voided'and(s.owner_participant_id=actor or exists(
  select 1 from private.creator_grants g where g.space_id=s.id and g.participant_id=actor and g.granted_by=s.owner_participant_id and g.enabled)))
$$;
create function private.creator_policy(trip uuid)
returns text language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare snapshot jsonb;
begin
 perform 1 from public.spaces s where s.id=trip and s.type='trip'and s.status<>'voided'for share;
 if not found then raise exception using message='space_membership_required',errcode='P0001';end if;
 perform 1 from public.space_members m join public.participants p on p.id=m.participant_id where m.space_id=trip order by m.participant_id for share of m,p;
 select jsonb_build_object('owner',s.owner_participant_id,'spaceVersion',s.version,
 'policyVersion',coalesce((select p.version from private.creator_policies p where p.space_id=trip),0),
 'members',(select jsonb_agg(jsonb_build_array(m.participant_id,m.role,m.removed_at,p.kind,p.auth_user_id)order by m.participant_id)from public.space_members m join public.participants p on p.id=m.participant_id where m.space_id=trip))into snapshot from public.spaces s where s.id=trip;
 return encode(extensions.digest(snapshot::text,'sha256'),'hex');
end$$;
create function private.creator_invalidate_grants()
returns trigger language plpgsql security definer set search_path='' as $$
declare trip uuid;target uuid;
begin
 if tg_table_name='spaces'then
  if new.owner_participant_id is not distinct from old.owner_participant_id then return new;end if;
  trip:=new.id;
 else
  if tg_op='UPDATE'and(new.removed_at is null or old.removed_at is not null)then return new;end if;
  trip:=old.space_id;target:=old.participant_id;
 end if;
 update private.creator_grants g set enabled=false,updated_at=now()where g.space_id=trip and g.enabled and(target is null or g.participant_id=target);
 insert into private.creator_policies(space_id,version)values(trip,1)on conflict(space_id)do update set version=creator_policies.version+1;
 insert into private.creator_audit(event_key,space_id,actor,kind,safe_diff)values('policy:'||gen_random_uuid(),trip,public.current_participant_id(),'proxy_policy_changed',jsonb_build_object('member',target));
 if tg_op='DELETE'then return old;end if;return new;
end$$;
create trigger creator_owner_changed after update of owner_participant_id on public.spaces for each row execute function private.creator_invalidate_grants();
create trigger creator_member_removed after update of removed_at or delete on public.space_members for each row execute function private.creator_invalidate_grants();
create function private.routed_build_core(actor uuid,trip uuid,draft jsonb,creator_mode boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare payments jsonb:=draft->'payments';p jsonb;line jsonb;e jsonb;leg jsonb;member uuid;sender uuid;receiver uuid;via uuid;k text;
 edges jsonb:='{}'::jsonb;reserved jsonb:='{}'::jsonb;ids jsonb:='{}'::jsonb;lefts jsonb:='{}'::jsonb;totals jsonb:='{}'::jsonb;lines jsonb:='[]'::jsonb;next_lines jsonb:='[]'::jsonb;issues jsonb:='[]'::jsonb;native jsonb:='[]'::jsonb;remaining jsonb:='[]'::jsonb;actors jsonb:='[]'::jsonb;sources jsonb:='[]'::jsonb;
 amount bigint;value bigint;route bigint;direct bigint;unapplied bigint;cap bigint;covered bigint;total bigint;net bigint;
 n numeric;d numeric;cash_group record;snapshot uuid;rates jsonb;quote jsonb;mode text:=draft->>'rateMode';
begin
 if creator_mode and not private.creator_can_record(trip,actor)then raise exception using message='creator_proxy_forbidden',errcode='P0001';end if;
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
  quote:=jsonb_build_object('numerator',n::text,'denominator',d::text,'source','system','provider',rates->'VND'->>'provider','rateDate',rates->'VND'->>'rateDate','snapshotId',snapshot);
 end if;
 for p in select q from jsonb_array_elements(payments)q order by q->>'id'loop
  sender:=(p->>'payer')::uuid;receiver:=(p->>'recipient')::uuid;via:=nullif(p->'via'->>'person','')::uuid;
  if coalesce(p->>'id','')!~'^[A-Za-z0-9_-]{1,80}$'or ids ? (p->>'id')or sender is null or receiver is null or sender=receiver or (not creator_mode and actor not in(sender,receiver))or p->>'tenderCurrency'not in('MYR','VND')or p->>'method'not in('cash','bank_transfer')then raise exception using message='routed_participant_denied',errcode='P0001';end if;
  if (p->>'tenderCurrency')is null or(p->>'method')is null or coalesce(p->>'tenderMinor','')!~'^[0-9]{1,16}$'then raise exception using message='invalid_amount',errcode='P0001';end if;
  ids:=ids||jsonb_build_object(p->>'id',true);k:=sender::text||':'||receiver::text||':'||(p->>'tenderCurrency');
  if ids ? k then raise exception using message='duplicate_tender',errcode='P0001';end if;ids:=ids||jsonb_build_object(k,true);
  for member in select distinct x from unnest(array[sender,receiver,via])x where x is not null order by x loop
   perform 1 from public.space_members sm join public.participants pt on pt.id=sm.participant_id where sm.space_id=trip and sm.participant_id=member and sm.removed_at is null and (pt.kind='account'or creator_mode and pt.kind='manual')for share of sm,pt;
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
 if mode='system' then
  if exists(select 1 from jsonb_array_elements(payments)q where q->>'tenderCurrency'='MYR')or exists(select 1 from jsonb_each(edges)edge cross join lateral jsonb_array_elements(edge.value->'native')leg where leg->>'currency'='MYR')then
   if n is null or d is null or n<=0 or d<=0 or quote->>'provider'is null or quote->>'rateDate'is null then raise exception using message='fx_rate_unavailable',errcode='P0001';end if;
   if snapshot is distinct from nullif(draft->>'snapshotId','')::uuid then raise exception using message='quote_changed',errcode='P0001';end if;
  else n:=1;d:=1;quote:=jsonb_build_object('numerator','1','denominator','1','source','identity');end if;
 end if;
 -- Aggregated actual cash must explain the same value; splitting MYR cents
 -- across payees must not manufacture a VND of extra native coverage.
 for cash_group in select q->'payment'->>'payer' payer,q->'payment'->>'tenderCurrency' code,sum((q->'payment'->>'tenderMinor')::bigint)::bigint amount,sum((q->>'valueMinor')::bigint)::bigint equivalent,jsonb_agg(q->'payment'->>'id') ids from jsonb_array_elements(lines)q group by 1,2 loop
  if private.routed_value(cash_group.amount,cash_group.code,n,d)<>cash_group.equivalent then issues:=issues||jsonb_build_array(jsonb_build_object('code','NATIVE_PRECISION','paymentIds',cash_group.ids));end if;
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
revoke all on function private.routed_build_core(uuid,uuid,jsonb,boolean)from public,anon,authenticated;
create or replace function private.routed_build(actor uuid,trip uuid,draft jsonb)
returns jsonb language sql security definer set search_path='' as $$select private.routed_build_core(actor,trip,draft,false)$$;
revoke all on function private.routed_build(uuid,uuid,jsonb)from public,anon,authenticated;
create function public.get_trip_creator_context(target_space_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();owner uuid;policy_hash text;
begin
 if private.space_role(target_space_id,actor)is null then raise exception using message='space_membership_required',errcode='P0001';end if;
 policy_hash:=private.creator_policy(target_space_id);select s.owner_participant_id into owner from public.spaces s where s.id=target_space_id;
 return jsonb_build_object('canRecord',private.creator_can_record(target_space_id,actor),'isCreator',owner=actor,'policyVersion',policy_hash,
 'name',(select p.display_name from public.participants p where p.id=actor),
 'members',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'kind',p.kind,'avatarUrl',case when length(u.avatar_url)<2048 and u.avatar_url~'^https://'then u.avatar_url else null end)||case when owner=actor then jsonb_build_object('delegated',coalesce(g.enabled and g.granted_by=owner,false))else '{}'::jsonb end order by p.display_name,p.id),'[]'::jsonb)
 from public.space_members m join public.participants p on p.id=m.participant_id left join public.user_profiles u on u.id=p.auth_user_id left join private.creator_grants g on g.space_id=m.space_id and g.participant_id=m.participant_id where m.space_id=target_space_id and m.removed_at is null));
end$$;
create function public.set_trip_creator_delegate(target_space_id uuid,participant_id uuid,enabled boolean,request_id uuid,expected_policy text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();owner uuid;receipt jsonb;policy_hash text;current_enabled boolean;
begin
 perform private.lock_collect_pay_balance();policy_hash:=private.creator_policy(target_space_id);
 select s.owner_participant_id into owner from public.spaces s where s.id=target_space_id;
 if owner is distinct from actor or private.space_role(target_space_id,actor)is null then raise exception using message='creator_proxy_forbidden',errcode='P0001';end if;
 receipt:=private.begin_money_operation(actor,request_id,'creator_delegate',jsonb_build_object('trip',target_space_id,'member',participant_id,'enabled',enabled,'policy',expected_policy));
 if receipt is not null then return public.get_trip_creator_context(target_space_id);end if;
 if enabled is null or participant_id=actor or not exists(select 1 from public.space_members m join public.participants p on p.id=m.participant_id where m.space_id=target_space_id and m.participant_id=participant_id and m.removed_at is null and p.kind='account')then raise exception using message='invalid_creator_delegate',errcode='P0001';end if;
 select coalesce(g.enabled and g.granted_by=owner,false)into current_enabled from private.creator_grants g where g.space_id=target_space_id and g.participant_id=set_trip_creator_delegate.participant_id;
 if coalesce(current_enabled,false)is distinct from enabled then
  if policy_hash is distinct from expected_policy then raise exception using message='creator_policy_changed',errcode='P0001';end if;
  insert into private.creator_grants(space_id,participant_id,granted_by,enabled)values(target_space_id,participant_id,actor,enabled)on conflict on constraint creator_grants_pkey do update set enabled=excluded.enabled,granted_by=excluded.granted_by,updated_at=now();
  insert into private.creator_policies(space_id,version)values(target_space_id,1)on conflict(space_id)do update set version=creator_policies.version+1;
  insert into private.creator_audit(event_key,space_id,actor,kind,safe_diff)values('delegate:'||actor||':'||request_id,target_space_id,actor,case when enabled then'proxy_granted'else'proxy_revoked'end,jsonb_build_object('member',participant_id));
 end if;
 perform private.finish_money_operation(actor,request_id,jsonb_build_object('member',participant_id,'enabled',enabled));return public.get_trip_creator_context(target_space_id);
end$$;
create unique index creator_one_replacement on private.creator_records(replacement_for)where replacement_for is not null;
create function private.creator_normalize(draft jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
#variable_conflict use_variable
declare occurred timestamptz;links jsonb;link jsonb;result jsonb;replacement uuid;
begin
 if jsonb_typeof(draft)is distinct from'object'or exists(select 1 from jsonb_object_keys(draft)k where k not in('rateMode','vndPerMyr','snapshotId','payments','occurredAt','note','ownAccountLinks','replacementFor'))then raise exception using message='creator_invalid_draft',errcode='P0001';end if;
 if coalesce(draft->>'occurredAt','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$'then raise exception using message='creator_invalid_time',errcode='P0001';end if;
 begin occurred:=(draft->>'occurredAt')::timestamptz;exception when others then raise exception using message='creator_invalid_time',errcode='P0001';end;
 if occurred is null or not isfinite(occurred)then raise exception using message='creator_invalid_time',errcode='P0001';end if;
 if draft ? 'note'and jsonb_typeof(draft->'note')is distinct from'string'or length(coalesce(draft->>'note',''))>500 then raise exception using message='creator_invalid_note',errcode='P0001';end if;
 links:=coalesce(draft->'ownAccountLinks','[]'::jsonb);
 if jsonb_typeof(links)is distinct from'array'or jsonb_array_length(links)>50 then raise exception using message='creator_invalid_account_link',errcode='P0001';end if;
 for link in select q from jsonb_array_elements(links)q loop
  if jsonb_typeof(link)is distinct from'object'or coalesce(link->>'paymentId','')!~'^[A-Za-z0-9_-]{1,80}$'or coalesce(link->>'accountId','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'or exists(select 1 from jsonb_object_keys(link)k where k not in('paymentId','accountId'))then raise exception using message='creator_invalid_account_link',errcode='P0001';end if;
 end loop;
 if(select count(*)from jsonb_array_elements(links))<>(select count(distinct q->>'paymentId')from jsonb_array_elements(links)q)then raise exception using message='creator_invalid_account_link',errcode='P0001';end if;
 select coalesce(jsonb_agg(jsonb_build_object('paymentId',q->>'paymentId','accountId',lower(q->>'accountId'))order by q->>'paymentId'),'[]'::jsonb)into links from jsonb_array_elements(links)q;
 if draft ? 'replacementFor'then
  begin replacement:=(draft->>'replacementFor')::uuid;exception when others then raise exception using message='creator_invalid_replacement',errcode='P0001';end;
  if replacement is null then raise exception using message='creator_invalid_replacement',errcode='P0001';end if;
 end if;
 result:=(draft-'occurredAt'-'note'-'ownAccountLinks'-'replacementFor')||jsonb_build_object('occurredAt',to_char(occurred at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'note',btrim(coalesce(draft->>'note','')),'ownAccountLinks',links);
 if replacement is not null then result:=result||jsonb_build_object('replacementFor',replacement);end if;return result;
end$$;
create function private.creator_review(actor uuid,trip uuid,draft jsonb,expires timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare plan jsonb;policy_hash text;own_auth jsonb:='{}'::jsonb;link jsonb;payment jsonb;replacement private.creator_records%rowtype;
begin
 policy_hash:=private.creator_policy(trip);
 if not private.creator_can_record(trip,actor)then raise exception using message='creator_proxy_forbidden',errcode='P0001';end if;
 if(draft->>'occurredAt')::timestamptz>clock_timestamp()+interval'5 minutes'then raise exception using message='creator_future_payment',errcode='P0001';end if;
 if draft ? 'replacementFor'then
  select * into replacement from private.creator_records r where r.id=(draft->>'replacementFor')::uuid for share;
  if replacement.id is null or replacement.space_id<>trip or replacement.status<>'reversed'or exists(select 1 from private.creator_records r where r.replacement_for=replacement.id)then raise exception using message='creator_invalid_replacement',errcode='P0001';end if;
 end if;
 plan:=private.routed_build_core(actor,trip,draft,true);
 for link in select q from jsonb_array_elements(draft->'ownAccountLinks')q order by q->>'accountId',q->>'paymentId'loop
  select q->'payment'into payment from jsonb_array_elements(plan->'lines')q where q->'payment'->>'id'=link->>'paymentId';
  if payment is null or actor::text not in(payment->>'payer',payment->>'recipient')then raise exception using message='creator_account_owner_required',errcode='P0001';end if;
  own_auth:=own_auth||jsonb_build_object(link->>'paymentId',private.trip_batch_account(actor,(link->>'accountId')::uuid,payment->>'tenderCurrency'));
 end loop;
 return jsonb_build_object('plan',plan,'policyHash',policy_hash,'ownAuthorizations',own_auth,'digest',case when jsonb_array_length(plan->'issues')=0 then encode(extensions.digest(jsonb_build_object('mode','creator_proxy','actor',actor,'trip',trip,'draft',draft,'plan',plan,'policy',policy_hash,'ownAuthorizations',own_auth,'expires',expires)::text,'sha256'),'hex')else null end);
end$$;
create function public.preview_trip_creator_settlement(target_space_id uuid,draft jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();normalized jsonb;review jsonb;expiry timestamptz:=now()+interval'10 minutes';
begin
 perform private.lock_collect_pay_balance();normalized:=private.creator_normalize(draft);review:=private.creator_review(actor,target_space_id,normalized,expiry);
 insert into private.creator_reviews(space_id,actor,digest,expires_at)values(target_space_id,actor,review->>'digest',expiry)on conflict on constraint creator_reviews_pkey do update set digest=excluded.digest,expires_at=excluded.expires_at,version=creator_reviews.version+1;
 return jsonb_build_object('plan',private.routed_public_plan(review->'plan'),'digest',review->'digest','expiresAt',expiry,'policyVersion',review->>'policyHash');
end$$;

create function private.creator_can_read(target uuid,actor uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.creator_records r where r.id=target and private.space_role(r.space_id,actor)is not null and(
  r.recorded_by=actor or private.creator_can_record(r.space_id,actor)or exists(select 1 from jsonb_array_elements(r.plan->'lines')q where actor::text in(q->'payment'->>'payer',q->'payment'->>'recipient',q->'payment'->'via'->>'person'))))
$$;
create function private.creator_view(target uuid,actor uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare rec private.creator_records%rowtype;plan jsonb;whole boolean;involved boolean;can_manage boolean;
begin
 select * into rec from private.creator_records r where r.id=target;
 if not private.creator_can_read(target,actor)then raise exception using message='creator_record_unavailable',errcode='P0001';end if;
 can_manage:=private.creator_can_record(rec.space_id,actor);whole:=can_manage or rec.recorded_by=actor;
 involved:=exists(select 1 from jsonb_array_elements(rec.plan->'lines')q where actor::text in(q->'payment'->>'payer',q->'payment'->>'recipient',q->'payment'->'via'->>'person'));
 plan:=private.routed_public_plan(rec.plan);
 if not whole then
  plan:=plan||jsonb_build_object(
   'lines',(select coalesce(jsonb_agg(q),'[]'::jsonb)from jsonb_array_elements(plan->'lines')q where actor::text in(q->'payment'->>'payer',q->'payment'->>'recipient',q->'payment'->'via'->>'person')),
   'coverage',(select coalesce(jsonb_agg(q),'[]'::jsonb)from jsonb_array_elements(plan->'coverage')q where actor::text in(q->>'from',q->>'to')),
   'remaining',(select coalesce(jsonb_agg(q),'[]'::jsonb)from jsonb_array_elements(plan->'remaining')q where actor::text in(q->>'from',q->>'to')));
 end if;
 if rec.status='reversed'then plan:=plan||jsonb_build_object('remaining','[]'::jsonb);end if;
 return jsonb_build_object('id',rec.id,'tripId',rec.space_id,'recordedByName',rec.recorded_by_name,'occurredAt',rec.occurred_at,'recordedAt',rec.recorded_at,'timeZone',rec.time_zone,
 'note',rec.shared_note,'people',(select coalesce(jsonb_agg(p),'[]'::jsonb)from jsonb_array_elements(rec.participant_names)p where exists(select 1 from jsonb_array_elements(plan->'lines')l where p->>'id'in(l->'payment'->>'payer',l->'payment'->>'recipient',l->'payment'->'via'->>'person'))),'status',rec.status,'version',rec.version,'plan',plan,'canManage',can_manage,'canReverse',can_manage and rec.status='posted',
 'canRequestCorrection',involved and rec.status='posted','reversedAt',rec.reversed_at,'reverseReason',rec.reverse_reason,
 'replacementFor',case when private.creator_can_read(rec.replacement_for,actor)then rec.replacement_for else null end,
 'replacementId',(select r.id from private.creator_records r where r.replacement_for=rec.id and private.creator_can_read(r.id,actor)),
 'correctionPending',exists(select 1 from private.creator_corrections c where c.record_id=rec.id and c.state='pending'and(can_manage or c.requested_by=actor)),
 'corrections',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'reason',c.reason,'requesterName',p.display_name,'status',c.state,'version',c.version,'createdAt',c.created_at,'resolution',c.resolution)order by c.created_at),'[]'::jsonb)from private.creator_corrections c join public.participants p on p.id=c.requested_by where c.record_id=rec.id and(can_manage or c.requested_by=actor)),
 'ownCash',(select coalesce(jsonb_agg(jsonb_build_object('lineId',l->'payment'->>'id','role',case when l->'payment'->>'payer'=actor::text then'payer'else'receiver'end,'currency',l->'payment'->>'tenderCurrency','amountMinor',l->'payment'->'tenderMinor','accountId',leg.account_id,'linked',leg.id is not null)),'[]'::jsonb)
 from jsonb_array_elements(rec.plan->'lines')l join private.creator_receipts rr on rr.record_id=rec.id and rr.line_id=l->'payment'->>'id'and rr.kind='cash'
 join public.settlement_allocations a on a.settlement_payment_id=rr.payment_id left join public.personal_settlement_cash_legs leg on leg.settlement_allocation_id=a.id and leg.owner_participant_id=actor
 where actor::text in(l->'payment'->>'payer',l->'payment'->>'recipient')));
end$$;
create function public.read_trip_creator_settlements(target_space_id uuid,record_id uuid default null,request_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();rec record;items jsonb:='[]'::jsonb;
begin
 if private.space_role(target_space_id,actor)is null then raise exception using message='space_membership_required',errcode='P0001';end if;
 for rec in select r.id from private.creator_records r where r.space_id=target_space_id and(record_id is null or r.id=record_id)and(request_id is null or r.recorded_by=actor and r.request_id=request_id)and private.creator_can_read(r.id,actor)order by r.recorded_at desc limit 100 loop items:=items||jsonb_build_array(private.creator_view(rec.id,actor));end loop;
 return items;
end$$;
create function private.creator_link_cash(target uuid,line_id text,actor uuid,account_id uuid)
returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare rec private.creator_records%rowtype;receipt private.creator_receipts%rowtype;allocation public.settlement_allocations%rowtype;payment public.settlement_payments%rowtype;cash public.personal_settlement_cash_legs%rowtype;cash_role text;
begin
 select * into rec from private.creator_records r where r.id=target for update;
 if rec.id is null or rec.status<>'posted'or not private.creator_can_read(rec.id,actor)then raise exception using message='creator_record_unavailable',errcode='P0001';end if;
 select * into receipt from private.creator_receipts r where r.record_id=target and r.line_id=creator_link_cash.line_id and r.kind='cash';
 select * into payment from public.settlement_payments p where p.id=receipt.payment_id;
 select * into allocation from public.settlement_allocations a where a.settlement_payment_id=payment.id;
 cash_role:=case when payment.debtor_participant_id=actor then'payer'when allocation.creditor_participant_id=actor then'receiver'else null end;
 if cash_role is null then raise exception using message='creator_account_owner_required',errcode='P0001';end if;
 perform private.trip_batch_account(actor,account_id,payment.currency);
 select * into cash from public.personal_settlement_cash_legs l where l.settlement_allocation_id=allocation.id and l.owner_participant_id=actor and l.role=cash_role for update;
 if cash.id is not null then
  if cash.account_id is distinct from account_id or cash.status<>'posted'then raise exception using message='idempotency_conflict',errcode='P0001';end if;return;
 end if;
 insert into public.personal_settlement_cash_legs(owner_participant_id,client_request_id,payload_fingerprint,settlement_payment_id,settlement_allocation_id,role,account_id,cash_amount_minor,account_currency,shared_amount_minor,gift_extra_minor,status)
 values(actor,private.money_child_request(rec.request_id,'creator:link:'||line_id||':'||actor),private.personal_payload_fingerprint(jsonb_build_object('allocation_id',allocation.id,'role',cash_role,'account_id',account_id,'cash_amount_minor',payment.amount_minor,'account_currency',payment.currency,'shared_amount_minor',payment.amount_minor,'gift_extra_minor',0)),payment.id,allocation.id,cash_role,account_id,payment.amount_minor,payment.currency,payment.amount_minor,0,'pending')returning * into cash;
 perform private.post_personal_settlement_cash_leg(cash.id);
end$$;
create function private.creator_post(target uuid)
returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare rec private.creator_records%rowtype;line jsonb;leg jsonb;link jsonb;pid uuid;e jsonb;states jsonb:='[]'::jsonb;payment_day date;
begin
 select * into rec from private.creator_records r where r.id=target;
 payment_day:=(rec.occurred_at at time zone rec.time_zone)::date;
 for line in select q from jsonb_array_elements(rec.plan->'lines')q loop
  insert into public.settlement_payments(client_request_id,scope,space_id,debtor_participant_id,currency,amount_minor,payment_date,status,note,fx_cash_only,cash_tracking_required)
  values(private.money_child_request(rec.request_id,'creator:cash:'||(line->'payment'->>'id')),'space',rec.space_id,(line->'payment'->>'payer')::uuid,line->'payment'->>'tenderCurrency',(line->'payment'->>'tenderMinor')::bigint,payment_day,'confirmed','fx-cash',true,false)returning id into pid;
  insert into public.settlement_allocations(settlement_payment_id,creditor_participant_id,amount_minor,state,responded_at)values(pid,(line->'payment'->>'recipient')::uuid,(line->'payment'->>'tenderMinor')::bigint,'accepted',now());
  insert into private.creator_receipts(record_id,payment_id,kind,line_id)values(rec.id,pid,'cash',line->'payment'->>'id');
  insert into public.financial_events(actor_participant_id,settlement_payment_id,event_type,safe_diff)values(rec.recorded_by,pid,'settlement.creator_cash_posted',jsonb_build_object('record_id',rec.id,'line_id',line->'payment'->>'id','method',line->'payment'->>'method','occurred_at',rec.occurred_at));
 end loop;
 for leg in select q from jsonb_array_elements(rec.plan->'native')q loop
  insert into public.settlement_payments(client_request_id,scope,space_id,debtor_participant_id,currency,amount_minor,payment_date,status,note,fx_cash_only,cash_tracking_required)
  values(private.money_child_request(rec.request_id,'creator:coverage:'||(leg->>'edgeId')||':'||(leg->>'currency')||':'||(leg->>'from')),'space',rec.space_id,(leg->>'from')::uuid,leg->>'currency',(leg->>'minor')::bigint,payment_day,'confirmed','fx-coverage',false,false)returning id into pid;
  insert into public.settlement_allocations(settlement_payment_id,creditor_participant_id,amount_minor,state,responded_at)values(pid,(leg->>'to')::uuid,(leg->>'minor')::bigint,'accepted',now());
  insert into private.creator_receipts(record_id,payment_id,kind)values(rec.id,pid,'coverage');
  insert into public.financial_events(actor_participant_id,settlement_payment_id,event_type,safe_diff)values(rec.recorded_by,pid,'settlement.creator_coverage_posted',jsonb_build_object('record_id',rec.id,'currency',leg->>'currency','minor',leg->'minor'));
 end loop;
 for link in select q from jsonb_array_elements(rec.draft->'ownAccountLinks')q order by q->>'accountId',q->>'paymentId'loop perform private.creator_link_cash(rec.id,link->>'paymentId',rec.recorded_by,(link->>'accountId')::uuid);end loop;
 for e in select q from jsonb_array_elements(rec.plan->'sources')q loop states:=states||jsonb_build_array(private.routed_edge(rec.space_id,(e->>'from')::uuid,(e->>'to')::uuid,(rec.plan->'rate'->>'numerator')::numeric,(rec.plan->'rate'->>'denominator')::numeric));end loop;
 update private.creator_records set after_state=states where id=rec.id;
end$$;
create function private.creator_notify(target uuid,kind text,actor uuid,event_key text,correction_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare rec private.creator_records%rowtype;person record;name text;
begin
 select * into rec from private.creator_records r where r.id=target;
 select p.display_name into name from public.participants p where p.id=actor;
 insert into private.creator_audit(event_key,space_id,record_id,actor,kind,safe_diff)values(event_key,rec.space_id,rec.id,actor,kind,jsonb_build_object('correction_id',correction_id));
 for person in select distinct p.id from public.participants p join public.space_members m on m.participant_id=p.id and m.space_id=rec.space_id and m.removed_at is null
 where p.kind='account'and p.auth_user_id is not null and p.id<>actor and(
 (kind in('creator_recorded','creator_reversed')and exists(select 1 from jsonb_array_elements(rec.plan->'lines')q where p.id::text in(q->'payment'->>'payer',q->'payment'->>'recipient',q->'payment'->'via'->>'person')))
 or(kind='correction_requested'and(p.id=rec.recorded_by or private.creator_can_record(rec.space_id,p.id)))
 or(kind='correction_resolved'and exists(select 1 from private.creator_corrections c where c.id=correction_id and c.requested_by=p.id)))loop
  insert into private.creator_outbox(event_key,record_id,recipient_id,actor_id,actor_name,kind,correction_id)values(event_key||':'||person.id,rec.id,person.id,actor,name,kind,correction_id)on conflict on constraint creator_outbox_pkey do nothing;
 end loop;
end$$;
create function public.record_trip_creator_settlement(target_space_id uuid,draft jsonb,request_id uuid,reviewed_digest text,expires_at timestamptz,attested boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();normalized jsonb;receipt jsonb;review jsonb;record_id uuid;zone text;name text;people jsonb;
begin
 if attested is distinct from true then raise exception using message='creator_attestation_required',errcode='P0001';end if;
 normalized:=private.creator_normalize(draft);
 receipt:=private.begin_money_operation(actor,request_id,'creator_record',jsonb_build_object('trip',target_space_id,'draft',normalized,'digest',reviewed_digest,'expires',expires_at,'attested',true));
 if receipt is not null then return private.creator_view((receipt->>'recordId')::uuid,actor);end if;
 perform private.lock_collect_pay_balance();
 if expires_at is null or expires_at<=clock_timestamp()or expires_at>clock_timestamp()+interval'10 minutes'then raise exception using message='quote_expired',errcode='P0001';end if;
 review:=private.creator_review(actor,target_space_id,normalized,expires_at);
 if review->>'digest'is null then raise exception using message='invalid_routed_plan',errcode='P0001';end if;
 if review->>'digest'is distinct from reviewed_digest or not exists(select 1 from private.creator_reviews q where q.space_id=target_space_id and q.actor=actor and q.digest=reviewed_digest and q.expires_at=record_trip_creator_settlement.expires_at)then raise exception using message='quote_changed',errcode='P0001';end if;
 select p.display_name,u.timezone into name,zone from public.participants p join public.user_profiles u on u.id=p.auth_user_id where p.id=actor;
 if zone is null or not exists(select 1 from pg_timezone_names t where t.name=zone)then zone:='Asia/Kuala_Lumpur';end if;
 select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'kind',p.kind)order by p.id)into people from public.participants p where exists(select 1 from jsonb_array_elements(review->'plan'->'actors')q where p.id=(q#>>'{}')::uuid);
 insert into private.creator_records(space_id,recorded_by,recorded_by_name,request_id,reviewed_digest,policy_hash,occurred_at,time_zone,shared_note,draft,plan,participant_names,replacement_for)
 values(target_space_id,actor,name,request_id,reviewed_digest,review->>'policyHash',(normalized->>'occurredAt')::timestamptz,zone,normalized->>'note',normalized,review->'plan',people,(normalized->>'replacementFor')::uuid)returning id into record_id;
 perform private.creator_post(record_id);
 perform private.creator_notify(record_id,'creator_recorded',actor,'creator-recorded:'||record_id);
 update private.creator_reviews set digest=null,version=version+1 where space_id=target_space_id and creator_reviews.actor=actor;
 perform private.finish_money_operation(actor,request_id,jsonb_build_object('recordId',record_id));return private.creator_view(record_id,actor);
end$$;
create function public.link_trip_creator_account(record_id uuid,line_id text,account_id uuid,request_id uuid,expected_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();receipt jsonb;rec private.creator_records%rowtype;already_linked boolean;
begin
 receipt:=private.begin_money_operation(actor,request_id,'creator_link_account',jsonb_build_object('record',record_id,'line',line_id,'account',account_id,'version',expected_version));
 if receipt is not null then return private.creator_view(record_id,actor);end if;
 perform private.lock_collect_pay_balance();select * into rec from private.creator_records r where r.id=record_id for update;
 if not private.creator_can_read(record_id,actor)then raise exception using message='creator_record_unavailable',errcode='P0001';end if;
 if rec.version is distinct from expected_version then raise exception using message='version_conflict',errcode='P0001';end if;
 select exists(select 1 from private.creator_receipts rr join public.personal_settlement_cash_legs l on l.settlement_payment_id=rr.payment_id where rr.record_id=record_id and rr.line_id=link_trip_creator_account.line_id and l.owner_participant_id=actor)into already_linked;
 perform private.creator_link_cash(record_id,line_id,actor,account_id);
 if already_linked then perform private.finish_money_operation(actor,request_id,jsonb_build_object('recordId',record_id));return private.creator_view(record_id,actor);end if;
 update private.creator_records set version=version+1 where id=record_id;
 insert into private.creator_audit(event_key,space_id,record_id,actor,kind,safe_diff)values('account-link:'||actor||':'||request_id,rec.space_id,record_id,actor,'own_account_linked',jsonb_build_object('line_id',line_id));
 perform private.finish_money_operation(actor,request_id,jsonb_build_object('recordId',record_id));return private.creator_view(record_id,actor);
end$$;
create function public.request_trip_creator_correction(record_id uuid,request_id uuid,reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();rec private.creator_records%rowtype;receipt jsonb;correction uuid;
begin
 reason:=btrim(reason);
 if reason is null or length(reason)not between 1 and 500 then raise exception using message='creator_invalid_reason',errcode='P0001';end if;
 receipt:=private.begin_money_operation(actor,request_id,'creator_correction',jsonb_build_object('record',record_id,'reason',reason));
 if receipt is not null then return private.creator_view(record_id,actor);end if;
 perform private.lock_collect_pay_balance();select * into rec from private.creator_records r where r.id=record_id for update;
 if not private.creator_can_read(record_id,actor)or not exists(select 1 from jsonb_array_elements(rec.plan->'lines')q where actor::text in(q->'payment'->>'payer',q->'payment'->>'recipient',q->'payment'->'via'->>'person'))then raise exception using message='creator_record_unavailable',errcode='P0001';end if;
 if rec.status<>'posted'then raise exception using message='creator_already_reversed',errcode='P0001';end if;
 select c.id into correction from private.creator_corrections c where c.record_id=record_id and c.requested_by=actor and c.state='pending';
 if correction is not null then
  if(select c.reason from private.creator_corrections c where c.id=correction)is distinct from reason then raise exception using message='creator_correction_pending',errcode='P0001';end if;
  perform private.finish_money_operation(actor,request_id,jsonb_build_object('recordId',record_id,'correctionId',correction));return private.creator_view(record_id,actor);
 end if;
 insert into private.creator_corrections(record_id,requested_by,request_id,reason)values(record_id,actor,request_id,reason)returning id into correction;
 perform private.creator_notify(record_id,'correction_requested',actor,'creator-correction:'||correction,correction);
 update private.creator_records set version=version+1 where id=record_id;
 perform private.finish_money_operation(actor,request_id,jsonb_build_object('recordId',record_id,'correctionId',correction));return private.creator_view(record_id,actor);
end$$;
create function public.resolve_trip_creator_correction(correction_id uuid,request_id uuid,expected_version integer,resolution text,replacement_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();correction private.creator_corrections%rowtype;rec private.creator_records%rowtype;receipt jsonb;
begin
 resolution:=btrim(resolution);
 if resolution is null or length(resolution)not between 1 and 500 then raise exception using message='creator_invalid_reason',errcode='P0001';end if;
 receipt:=private.begin_money_operation(actor,request_id,'creator_resolve_correction',jsonb_build_object('correction',correction_id,'version',expected_version,'resolution',resolution,'replacement',replacement_id));
 select * into correction from private.creator_corrections c where c.id=correction_id;
 if receipt is not null then return private.creator_view(correction.record_id,actor);end if;
 perform private.lock_collect_pay_balance();select * into correction from private.creator_corrections c where c.id=correction_id for update;
 select * into rec from private.creator_records r where r.id=correction.record_id for update;
 if rec.id is null or not private.creator_can_record(rec.space_id,actor)then raise exception using message='creator_proxy_forbidden',errcode='P0001';end if;
 if correction.version is distinct from expected_version or correction.state<>'pending'then raise exception using message='version_conflict',errcode='P0001';end if;
 if replacement_id is not null and not exists(select 1 from private.creator_records r where r.id=replacement_id and r.space_id=rec.space_id and r.replacement_for=rec.id and r.status='posted')then raise exception using message='creator_invalid_replacement',errcode='P0001';end if;
 update private.creator_corrections set state=case when rec.status='reversed'then'resolved'else'dismissed'end,version=version+1,resolved_at=now(),resolved_by=actor,resolution=resolve_trip_creator_correction.resolution,replacement_id=resolve_trip_creator_correction.replacement_id where id=correction_id;
 update private.creator_records set version=version+1 where id=rec.id;
 perform private.creator_notify(rec.id,'correction_resolved',actor,'creator-correction-resolved:'||correction_id,correction_id);
 perform private.finish_money_operation(actor,request_id,jsonb_build_object('recordId',rec.id));return private.creator_view(rec.id,actor);
end$$;
create function public.reverse_trip_creator_settlement(record_id uuid,request_id uuid,expected_version integer,reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();rec private.creator_records%rowtype;receipt jsonb;states jsonb:='[]'::jsonb;e jsonb;allocation record;previous text:=current_setting('tabby.fx_bundle_reversal',true);
begin
 reason:=btrim(reason);
 if reason is null or length(reason)not between 1 and 500 then raise exception using message='creator_invalid_reason',errcode='P0001';end if;
 receipt:=private.begin_money_operation(actor,request_id,'creator_reverse',jsonb_build_object('record',record_id,'version',expected_version,'reason',reason));
 if receipt is not null then return private.creator_view(record_id,actor);end if;
 perform private.lock_collect_pay_balance();select * into rec from private.creator_records r where r.id=record_id for update;
 if rec.id is null or not private.creator_can_record(rec.space_id,actor)then raise exception using message='creator_proxy_forbidden',errcode='P0001';end if;
 perform private.creator_policy(rec.space_id);
 if rec.status='reversed'then perform private.finish_money_operation(actor,request_id,jsonb_build_object('recordId',record_id));return private.creator_view(record_id,actor);end if;
 if rec.version is distinct from expected_version then raise exception using message='version_conflict',errcode='P0001';end if;
 -- Historical participants need not remain members; the current manager and
 -- immutable original sources authorize this accounting reversal.
 for e in select q from jsonb_array_elements(rec.plan->'sources')q loop states:=states||jsonb_build_array(private.routed_edge(rec.space_id,(e->>'from')::uuid,(e->>'to')::uuid,(rec.plan->'rate'->>'numerator')::numeric,(rec.plan->'rate'->>'denominator')::numeric));end loop;
 if states is distinct from rec.after_state then raise exception using message='routed_reversal_dependency',errcode='P0001';end if;
 perform set_config('tabby.fx_bundle_reversal','on',true);
 for allocation in select a.* from private.creator_receipts rr join public.settlement_allocations a on a.settlement_payment_id=rr.payment_id where rr.record_id=rec.id order by a.id loop
  insert into public.settlement_allocation_reversals(client_request_id,settlement_allocation_id,reversed_by,amount_minor,reason)values(private.money_child_request(request_id,allocation.id::text),allocation.id,actor,allocation.amount_minor,'creator-whole-reversal');
  perform public.recompute_settlement_status(allocation.settlement_payment_id);
  insert into public.financial_events(actor_participant_id,settlement_payment_id,event_type,safe_diff)values(actor,allocation.settlement_payment_id,'settlement.creator_reversed',jsonb_build_object('record_id',rec.id));
 end loop;
 perform set_config('tabby.fx_bundle_reversal',coalesce(previous,''),true);
 update private.creator_records set status='reversed',version=version+1,reversed_at=now(),reversed_by=actor,reverse_reason=reason where id=rec.id;
 perform private.creator_notify(rec.id,'creator_reversed',actor,'creator-reversed:'||rec.id);
 perform private.finish_money_operation(actor,request_id,jsonb_build_object('recordId',record_id));return private.creator_view(record_id,actor);
end$$;

create function private.deliver_creator_notices(recipient uuid default null,batch_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare item record;delivered integer:=0;state text;
begin
 for item in select o.* from private.creator_outbox o where o.status='pending'and(recipient is null or o.recipient_id=recipient)order by o.created_at,o.event_key limit greatest(1,least(batch_limit,500))for update skip locked loop
  begin
   perform 1 from public.space_members m join private.creator_records r on r.space_id=m.space_id where r.id=item.record_id and m.participant_id=item.recipient_id and m.removed_at is null for share of m;
   if not found or not private.creator_can_read(item.record_id,item.recipient_id)or not exists(select 1 from public.participants p where p.id=item.recipient_id and p.kind='account'and p.auth_user_id is not null)then
    update private.creator_outbox set status='skipped',attempts=attempts+1 where event_key=item.event_key;continue;
   end if;
   insert into public.creator_settlement_notices(event_key,record_id,recipient_id,actor_name,kind,correction_id,created_at)values(item.event_key,item.record_id,item.recipient_id,item.actor_name,item.kind,item.correction_id,item.created_at)on conflict(event_key)do nothing;
   update private.creator_outbox set status='delivered',attempts=attempts+1,delivered_at=now(),last_error=null where event_key=item.event_key;delivered:=delivered+1;
  exception when others then
   get stacked diagnostics state=returned_sqlstate;
   update private.creator_outbox set attempts=attempts+1,last_error=state where event_key=item.event_key;
  end;
 end loop;return delivered;
end$$;
create function public.can_read_creator_settlement_notice(target uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.creator_settlement_notices n where n.id=target and n.recipient_id=public.current_participant_id()and private.creator_can_read(n.record_id,public.current_participant_id()))
$$;
create policy creator_notice_recipient on public.creator_settlement_notices for select to authenticated using(recipient_id=public.current_participant_id()and public.can_read_creator_settlement_notice(id));
grant select on public.creator_settlement_notices to authenticated;
create function public.get_creator_settlement_notifications(target_notice_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();items jsonb;managed jsonb;
begin
 perform private.deliver_creator_notices(actor,100);
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'recordId',n.record_id,'tripId',r.space_id,'tripName',(select s.name from public.spaces s where s.id=r.space_id),'actorName',n.actor_name,'kind',n.kind,'date',n.created_at,'version',coalesce(c.version,1),'pending',coalesce(c.state='pending',false))order by n.created_at desc),'[]'::jsonb)into items
 from(select q.* from public.creator_settlement_notices q where q.recipient_id=actor and(target_notice_id is null or q.id=target_notice_id)and private.creator_can_read(q.record_id,actor)order by q.created_at desc limit 100)n join private.creator_records r on r.id=n.record_id left join private.creator_corrections c on c.id=n.correction_id;
 select coalesce(jsonb_agg(rr.payment_id),'[]'::jsonb)into managed from private.creator_receipts rr join private.creator_records r on r.id=rr.record_id join public.settlement_payments p on p.id=rr.payment_id
 where private.creator_can_read(r.id,actor)and(p.debtor_participant_id=actor or exists(select 1 from public.settlement_allocations a where a.settlement_payment_id=p.id and a.creditor_participant_id=actor));
 return jsonb_build_object('notices',items,'managedPaymentIds',managed);
end$$;
-- The outbox worker is private. Poll/focus feeds drain the current recipient;
-- the existing scheduler also delivers without requiring an open browser.
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')then
  alter publication supabase_realtime add table public.creator_settlement_notices;
 end if;
 if exists(select 1 from pg_extension where extname='pg_cron')then
  perform cron.schedule('tabby-creator-notices','* * * * *','select private.deliver_creator_notices(null,100);');
 end if;
end$$;

revoke all on function private.creator_can_record(uuid,uuid)from public,anon,authenticated;
revoke all on function private.creator_policy(uuid)from public,anon,authenticated;
revoke all on function private.creator_invalidate_grants()from public,anon,authenticated;
revoke all on function private.routed_build_core(uuid,uuid,jsonb,boolean)from public,anon,authenticated;
revoke all on function private.routed_build(uuid,uuid,jsonb)from public,anon,authenticated;
revoke all on function public.get_trip_creator_context(uuid)from public,anon,authenticated;
grant execute on function public.get_trip_creator_context(uuid)to authenticated;
revoke all on function public.set_trip_creator_delegate(uuid,uuid,boolean,uuid,text)from public,anon,authenticated;
grant execute on function public.set_trip_creator_delegate(uuid,uuid,boolean,uuid,text)to authenticated;
revoke all on function private.creator_normalize(jsonb)from public,anon,authenticated;
revoke all on function private.creator_review(uuid,uuid,jsonb,timestamptz)from public,anon,authenticated;
revoke all on function public.preview_trip_creator_settlement(uuid,jsonb)from public,anon,authenticated;
grant execute on function public.preview_trip_creator_settlement(uuid,jsonb)to authenticated;
revoke all on function private.creator_can_read(uuid,uuid)from public,anon,authenticated;
revoke all on function private.creator_view(uuid,uuid)from public,anon,authenticated;
revoke all on function public.read_trip_creator_settlements(uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.read_trip_creator_settlements(uuid,uuid,uuid)to authenticated;
revoke all on function private.creator_link_cash(uuid,text,uuid,uuid)from public,anon,authenticated;
revoke all on function private.creator_post(uuid)from public,anon,authenticated;
revoke all on function private.creator_notify(uuid,text,uuid,text,uuid)from public,anon,authenticated;
revoke all on function public.record_trip_creator_settlement(uuid,jsonb,uuid,text,timestamptz,boolean)from public,anon,authenticated;
grant execute on function public.record_trip_creator_settlement(uuid,jsonb,uuid,text,timestamptz,boolean)to authenticated;
revoke all on function public.link_trip_creator_account(uuid,text,uuid,uuid,integer)from public,anon,authenticated;
grant execute on function public.link_trip_creator_account(uuid,text,uuid,uuid,integer)to authenticated;
revoke all on function public.request_trip_creator_correction(uuid,uuid,text)from public,anon,authenticated;
grant execute on function public.request_trip_creator_correction(uuid,uuid,text)to authenticated;
revoke all on function public.resolve_trip_creator_correction(uuid,uuid,integer,text,uuid)from public,anon,authenticated;
grant execute on function public.resolve_trip_creator_correction(uuid,uuid,integer,text,uuid)to authenticated;
revoke all on function public.reverse_trip_creator_settlement(uuid,uuid,integer,text)from public,anon,authenticated;
grant execute on function public.reverse_trip_creator_settlement(uuid,uuid,integer,text)to authenticated;
revoke all on function private.deliver_creator_notices(uuid,integer)from public,anon,authenticated;
revoke all on function public.can_read_creator_settlement_notice(uuid)from public,anon,authenticated;
grant execute on function public.can_read_creator_settlement_notice(uuid)to authenticated;
revoke all on function public.get_creator_settlement_notifications(uuid)from public,anon,authenticated;
grant execute on function public.get_creator_settlement_notifications(uuid)to authenticated;
notify pgrst,'reload schema';
commit;
