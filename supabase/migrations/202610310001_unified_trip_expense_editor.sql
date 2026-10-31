-- Issue07: one canonical expense, owner-private Trip association, atomic editor.
-- Legacy rows and original RLS/financial authority remain unchanged. No reclassification.
begin;
alter table public.personal_expense_affiliations add column trip_id uuid references public.spaces(id) on delete restrict;
create index personal_affiliation_trip_idx on public.personal_expense_affiliations(owner_participant_id,trip_id,expense_id) where trip_id is not null;

create table public.expense_editor_settings (
 expense_id uuid primary key references public.expenses(id),
 consumer_ids uuid[] not null,
 split_mode text not null check(split_mode in ('equal','exact','items')),
 items jsonb not null default '[]'::jsonb check(jsonb_typeof(items)='array'),
 updated_at timestamptz not null default now()
);
alter table public.expense_editor_settings enable row level security;
create policy expense_editor_settings_read on public.expense_editor_settings for select to authenticated using (private.can_read_expense(expense_id,public.current_participant_id()));
revoke all on public.expense_editor_settings from public,anon,authenticated;
grant select on public.expense_editor_settings to authenticated;

create function private.link_personal_trip_expense(actor uuid,expense uuid,trip uuid)
returns void language plpgsql security definer set search_path='' as $$
declare title text;
begin
 if not exists(select 1 from public.expenses e where e.id=expense and e.scope='personal' and e.created_by=actor) then raise exception using message='private_expense_owner_required',errcode='P0001';end if;
 select s.name into title from public.spaces s where s.id=trip and s.type='trip' and s.status<>'voided' and private.space_role(s.id,actor) is not null;
 if title is null then raise exception using message='trip_not_accessible',errcode='P0001';end if;
 insert into public.personal_expense_affiliations(owner_participant_id,expense_id,label,trip_id) values(actor,expense,title,trip)
 on conflict(owner_participant_id,expense_id) do update set trip_id=excluded.trip_id,label=excluded.label,archived_at=null,version=personal_expense_affiliations.version+1;
end $$;

-- UI selections (including explicit zero consumers) are persisted separately
-- from immutable contribution/share facts, under exactly the parent RLS.
create function private.save_trip_editor_settings(expense uuid,consumer_ids uuid[],mode text,items jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare e public.expenses%rowtype;item jsonb;people uuid[];units numeric;unit_amount bigint;total numeric:=0;expected jsonb:='{}'::jsonb;person uuid;digits integer;
begin
 if mode is null or mode not in ('equal','exact','items') or items is null or jsonb_typeof(items)<>'array' or consumer_ids is null or cardinality(consumer_ids)=0
 or array_position(consumer_ids,null) is not null or cardinality(consumer_ids)>(select count(*)from public.expense_participations p where p.expense_id=expense)
 or cardinality(consumer_ids)<>(select count(distinct x)from unnest(consumer_ids)x)
 or exists(select 1 from unnest(consumer_ids)x where not exists(select 1 from public.expense_participations p where p.expense_id=expense and p.participant_id=x))
 or exists(select 1 from public.expense_shares s join public.expense_participations p on p.id=s.expense_participation_id where s.expense_id=expense and s.amount_minor>0 and not(p.participant_id=any(consumer_ids)))
 then raise exception using message='invalid_consumers',errcode='P0001';end if;
 select * into e from public.expenses where id=expense;
 consumer_ids:=array(select p.participant_id from public.expense_participations p where p.expense_id=expense and p.participant_id=any(consumer_ids)order by p.participant_order);
 if mode='equal' then
  for i in 1..cardinality(consumer_ids)loop expected:=jsonb_set(expected,array[consumer_ids[i]::text],to_jsonb(e.total_minor/cardinality(consumer_ids)+case when i<=e.total_minor%cardinality(consumer_ids)then 1 else 0 end));end loop;
 elsif mode='items' then
  if jsonb_array_length(items)=0 or jsonb_array_length(items)>500 then raise exception using message='invalid_items',errcode='P0001';end if;
  digits:=case when e.currency in('JPY','KRW','VND')then 0 when e.currency in('AUD','CNY','EUR','GBP','HKD','MYR','SGD','THB','TWD','USD')then 2 else null end;
  if digits is null then raise exception using message='invalid_currency',errcode='P0001';end if;
  for item in select * from jsonb_array_elements(items)loop
   if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'participantIds')is distinct from'array' or coalesce(item->>'id','')='' or coalesce(item->>'amount','')!~'^[0-9]+([.][0-9]+)?$' then raise exception using message='invalid_items',errcode='P0001';end if;
   people:=array(select jsonb_array_elements_text(item->'participantIds')::uuid);
   if cardinality(people)=0 or cardinality(people)<>(select count(distinct p)from unnest(people)p) or exists(select 1 from unnest(people)p where p is null or not(p=any(consumer_ids)))then raise exception using message='invalid_items',errcode='P0001';end if;
   if length(split_part(item->>'amount','.',2))>digits then raise exception using message='invalid_items',errcode='P0001';end if;
   units:=(item->>'amount')::numeric*power(10::numeric,digits);
   if units<=0 or units<>trunc(units)or units>9007199254740991 then raise exception using message='invalid_items',errcode='P0001';end if;
   unit_amount:=units::bigint;total:=total+units;
   for i in 1..cardinality(people)loop person:=people[i];expected:=jsonb_set(expected,array[person::text],to_jsonb(coalesce((expected->>person::text)::bigint,0)+unit_amount/cardinality(people)+case when i<=unit_amount%cardinality(people)then 1 else 0 end));end loop;
  end loop;
  if total<>e.total_minor then raise exception using message='item_total_mismatch',errcode='P0001';end if;
 end if;
 -- Validate UI metadata against canonical shares; the original RPC still writes
 -- and reconciles all financial rows. Metadata can never replace those facts.
 if mode in('equal','items')and exists(select 1 from public.expense_shares s join public.expense_participations p on p.id=s.expense_participation_id where s.expense_id=expense and s.amount_minor<>coalesce((expected->>p.participant_id::text)::bigint,0))then raise exception using message='split_metadata_mismatch',errcode='P0001';end if;
 insert into public.expense_editor_settings(expense_id,consumer_ids,split_mode,items)values(expense,consumer_ids,mode,items)
 on conflict(expense_id)do update set consumer_ids=excluded.consumer_ids,split_mode=excluded.split_mode,items=excluded.items,updated_at=now();
end $$;

create function public.get_trip_expense_editor(target_expense_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=public.current_participant_id(); e public.expenses%rowtype;a public.personal_expense_affiliations%rowtype;s public.spaces%rowtype;r text;funding jsonb; settings jsonb;members jsonb;
begin
 if actor is null then raise exception using message='not_authenticated',errcode='P0001';end if;
 if not private.can_read_expense(target_expense_id,actor) then raise exception using message='expense_not_visible',errcode='P0001';end if;
 select * into e from public.expenses where id=target_expense_id;
 if e.scope='personal' and e.created_by=actor then
  select * into a from public.personal_expense_affiliations where expense_id=e.id and owner_participant_id=actor and trip_id is not null and archived_at is null;
 elsif e.scope<>'space' then return null;end if;
 select * into s from public.spaces where id=coalesce(e.space_id,a.trip_id) and type='trip';
 if s.id is null then return null;end if;
 r:=private.space_role(s.id,actor);
 -- Do not disclose a current roster/renamed Trip after membership loss.
 if r is not null then select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'kind',p.kind,'role',m.role)order by m.joined_at,p.id),'[]'::jsonb)into members from public.space_members m join public.participants p on p.id=m.participant_id where m.space_id=s.id and m.removed_at is null;else members:='[]'::jsonb;end if;
 select to_jsonb(x) into settings from public.expense_editor_settings x where x.expense_id=e.id;
 with recursive chain as(select id,corrects_expense_id from public.expenses where id=e.id union all select parent.id,parent.corrects_expense_id from public.expenses parent join chain c on parent.id=c.corrects_expense_id)
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'expense_id',f.expense_id,'status',f.status,'version',f.version,'account_id',f.account_id,'account_name',acc.name,'account_currency',f.account_currency,'expense_amount_minor',f.expense_amount_minor,'expense_currency',f.expense_currency,'primary_account_id',b.primary_account_id)order by f.created_at),'[]'::jsonb)into funding
 from public.personal_funding_intents f join chain c on c.id=f.expense_id left join public.personal_accounts acc on acc.id=f.account_id left join public.personal_funding_bundles b on b.funding_intent_id=f.id where f.owner_participant_id=actor;
 return jsonb_build_object('schema_version',1,'audience',case when e.scope='personal' then 'private' else 'shared' end,
 'trip_id',s.id,'trip_name',case when r is null then a.label else s.name end,'role',r,'trip_status',case when r is null then null else s.status end,
 'can_edit',public.is_permanent_account() and e.status='active' and not coalesce((public.shared_restart_state(e)->>'hidden_for_viewer')::boolean,false) and(case when e.scope='personal' then e.created_by=actor else r in ('owner','full_access')and(e.created_by=actor or r='owner')end),
 'expense',to_jsonb(e)||jsonb_build_object('shared_restart_state',public.shared_restart_state(e)),'members',members,'settings',settings,'funding',funding,
 'accounts',(select coalesce(jsonb_agg(jsonb_build_object('id',own_account.id,'name',own_account.name,'currency',own_account.currency)order by own_account.name,own_account.id),'[]'::jsonb)from public.personal_accounts own_account where own_account.owner_participant_id=actor and own_account.archived_at is null and not exists(select 1 from public.personal_account_currencies c where c.account_id=own_account.id)),
 'participations',(select coalesce(jsonb_agg(to_jsonb(p)order by p.participant_order),'[]'::jsonb)from public.expense_participations p where p.expense_id=e.id),
 'contributions',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb)from public.payer_contributions p where p.expense_id=e.id),
 'shares',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb)from public.expense_shares p where p.expense_id=e.id));
end $$;

create function public.save_trip_expense_editor(request_id uuid,target_expense_id uuid,expected_version integer,target_trip_id uuid,desired_audience text,confirm_private boolean,expense_payload jsonb,consumer_ids uuid[],split_mode text default 'exact',items jsonb default '[]'::jsonb,account_choice jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();e public.expenses%rowtype;next_id uuid;next_version integer;trip uuid;r text;result jsonb;ids uuid[];paid bigint[];shares bigint[];amount bigint;old_ids uuid[];old_paid bigint[];old_shares bigint[];financial_changed boolean;candidate text;old_audience text;aff public.personal_expense_affiliations%rowtype;f public.personal_funding_intents%rowtype;own_paid bigint;choice_intent uuid;choice_version integer;choice_parent uuid;
begin
 result:=private.begin_money_operation(actor,request_id,'trip_expense_edit',jsonb_build_object('target',target_expense_id,'version',expected_version,'trip',target_trip_id,'audience',desired_audience,'confirm_private',confirm_private,'payload',expense_payload,'consumers',consumer_ids,'mode',split_mode,'items',items,'account_choice',account_choice));
 if result is not null then return result;end if;
 perform private.lock_expense_target(target_expense_id);
 if not private.can_read_expense(target_expense_id,actor)then raise exception using message='expense_not_visible',errcode='P0001';end if;
 select * into e from public.expenses where id=target_expense_id for update;
 if e.status<>'active' or e.version is distinct from expected_version then raise exception using message='version_conflict',errcode='P0001';end if;
 if e.scope='personal' then select * into aff from public.personal_expense_affiliations where expense_id=e.id and owner_participant_id=actor and trip_id is not null and archived_at is null;trip:=aff.trip_id;old_audience:='private';
 elsif e.scope='space' then trip:=e.space_id;old_audience:='shared';else raise exception using message='trip_expense_required',errcode='P0001';end if;
 if trip is null or trip is distinct from target_trip_id or not exists(select 1 from public.spaces s where s.id=trip and s.type='trip')then raise exception using message='trip_expense_required',errcode='P0001';end if;
 r:=private.space_role(trip,actor);
 if e.scope='personal' then if e.created_by<>actor then raise exception using message='expense_write_denied',errcode='P0001';end if;
 elsif r not in('owner','full_access') or r is null or (e.created_by<>actor and r<>'owner') then raise exception using message='expense_write_denied',errcode='P0001';end if;
 if coalesce((public.shared_restart_state(e)->>'hidden_for_viewer')::boolean,false)then raise exception using message='expense_write_denied',errcode='P0001';end if;
 if desired_audience not in('private','shared') or desired_audience is null then raise exception using message='invalid_audience',errcode='P0001';end if;
 ids:=array(select jsonb_array_elements_text(expense_payload->'participant_ids')::uuid);paid:=array(select jsonb_array_elements_text(expense_payload->'contribution_amounts')::bigint);shares:=array(select jsonb_array_elements_text(expense_payload->'share_amounts')::bigint);amount:=(expense_payload->>'total_minor')::bigint;
 perform private.assert_reconciled_expense_payload(amount,ids,paid,shares);
 if upper(expense_payload->>'currency_code') is distinct from e.currency then raise exception using message='currency_change_requires_cancel_and_new',errcode='P0001';end if;
 if (expense_payload->>'occurred_on')::date is null then raise exception using message='invalid_expense_date',errcode='P0001';end if;
 if consumer_ids is null or cardinality(consumer_ids)=0 or exists(select 1 from unnest(consumer_ids)c where not(c=any(ids)))then raise exception using message='invalid_consumers',errcode='P0001';end if;
 candidate:=case when exists(select 1 from unnest(consumer_ids)c where c<>e.created_by)or exists(select 1 from unnest(ids,paid)x(id,value)where id<>e.created_by and value>0)then 'shared'else'private'end;
 if desired_audience='private' and (candidate<>'private' or cardinality(ids)<>1 or ids[1]<>e.created_by)then raise exception using message='private_owner_only',errcode='P0001';end if;
 if old_audience='private' and candidate='shared' and desired_audience<>'shared' then raise exception using message='shared_audience_required',errcode='P0001';end if;
 select array_agg(p.participant_id order by p.participant_order),array_agg(coalesce(c.amount_minor,0)order by p.participant_order),array_agg(s.amount_minor order by p.participant_order)into old_ids,old_paid,old_shares from public.expense_participations p left join public.payer_contributions c on c.expense_participation_id=p.id join public.expense_shares s on s.expense_participation_id=p.id where p.expense_id=e.id;
 financial_changed:=amount<>e.total_minor or ids<>old_ids or paid<>old_paid or shares<>old_shares;
 if desired_audience='shared' and(financial_changed or old_audience='private')then
  if r is null or r not in('owner','full_access')then raise exception using message='space_write_denied',errcode='P0001';end if;
  if exists(select 1 from unnest(ids)x where not exists(select 1 from public.space_members m where m.space_id=trip and m.participant_id=x and m.removed_at is null))then raise exception using message='participant_not_in_space',errcode='P0001';end if;
 end if;
 if desired_audience<>old_audience then
  -- Reuse the existing write exclusion before checking settlement dependencies.
  -- A competing settlement/correction fails safely; no partially hidden bill.
  perform private.lock_collect_pay_balance();
  if e.created_by<>actor then raise exception using message='audience_owner_required',errcode='P0001';end if;
  if desired_audience='private' then
   if not coalesce(confirm_private,false)then raise exception using message='private_confirmation_required',errcode='P0001';end if;
   -- Conservative: no hiding any existing obligation or settlement/reversal fact.
   if exists(select 1 from unnest(old_ids,old_paid,old_shares)x(id,p,s)where id<>actor and(p>0 or s>0))
    or exists(select 1 from public.settlement_payments p where p.scope='space' and p.space_id=trip)
    or public.shared_restart_state(e) is not null then raise exception using message='audience_transition_has_dependencies',errcode='P0001';end if;
  end if;
  if exists(select 1 from public.expenses child where child.corrects_expense_id=e.id)then raise exception using message='authoritative_child_exists',errcode='P0001';end if;
  next_id:=gen_random_uuid();next_version:=1;
  insert into public.expenses(id,client_request_id,scope,space_id,created_by,total_minor,participant_count,currency,description,category,occurred_on,status,corrects_expense_id)
  values(next_id,private.money_child_request(request_id,'audience-correction'),case when desired_audience='private'then'personal'else'space'end,case when desired_audience='shared'then trip else null end,actor,amount,cardinality(ids),e.currency,nullif(btrim(expense_payload->>'description'),''),coalesce(nullif(btrim(expense_payload->>'category'),''),'Other'),(expense_payload->>'occurred_on')::date,'active',e.id);
  perform private.insert_expense_financial_rows(next_id,actor,case when desired_audience='private'then'personal'else'space'end,ids,paid,shares);
  update public.expenses set status='voided',termination_kind='corrected',voided_at=now(),voided_by=actor,version=version+1 where id=e.id;
  insert into public.financial_events(actor_participant_id,expense_id,event_type,safe_diff)values(actor,e.id,'expense.corrected',jsonb_build_object('replacement_expense_id',next_id,'previous_version',e.version));
 elsif e.scope='space' and financial_changed then
  result:=public.correct_space_expense(private.money_child_request(request_id,'space-correction'),e.id,e.version,amount,e.currency,expense_payload->>'description',expense_payload->>'category',(expense_payload->>'occurred_on')::date,ids,paid,shares);next_id:=(result->>'replacement_expense_id')::uuid;next_version:=(result->>'replacement_version')::integer;
 else
  next_id:=e.id;next_version:=e.version;
  if financial_changed then next_version:=public.replace_expense_financials(e.id,next_version,amount,e.currency,ids,paid,shares);end if;
  if e.description is distinct from nullif(btrim(expense_payload->>'description'),'') or e.category is distinct from expense_payload->>'category' or e.occurred_on is distinct from(expense_payload->>'occurred_on')::date then
   next_version:=public.update_expense_metadata(e.id,expense_payload->>'description',expense_payload->>'category',(expense_payload->>'occurred_on')::date,next_version);
  end if;
 end if;
 if next_id=e.id and next_version=e.version then next_version:=public.update_expense_metadata(e.id,e.description,e.category,e.occurred_on,e.version);end if;
 if desired_audience='private' and next_id<>e.id then perform private.link_personal_trip_expense(actor,next_id,trip);end if;
 perform private.save_trip_editor_settings(next_id,consumer_ids,split_mode,items);
 -- Preserve posted journals/IDs. Only unposted funding follows its canonical
 -- successor; this never posts, duplicates, reverses or estimates cash.
 if next_id<>e.id then
  for f in select * from public.personal_funding_intents where expense_id=e.id and owner_participant_id=actor and status='pending' for update loop
   select coalesce((select x.paid from unnest(ids,paid)x(id,paid)where x.id=f.owner_participant_id),0)into own_paid;
   if own_paid>0 then update public.personal_funding_intents set expense_id=next_id,expense_amount_minor=own_paid,expense_currency=e.currency,version=version+1 where id=f.id;
   else perform public.cancel_pending_funding(private.money_child_request(request_id,'cancel-funding:'||f.id::text),f.id);end if;
  end loop;
 end if;
 if account_choice is not null then
  if jsonb_typeof(account_choice)<>'object' or not(account_choice?'intent_id') or not(account_choice?'version') or not(account_choice?'account_id') then raise exception using message='invalid_funding_selection',errcode='P0001';end if;
  choice_intent:=(account_choice->>'intent_id')::uuid;choice_version:=(account_choice->>'version')::integer;choice_parent:=(account_choice->>'account_id')::uuid;
  if exists(with recursive chain as(select id,corrects_expense_id from public.expenses where id=next_id union select parent.id,parent.corrects_expense_id from public.expenses parent join chain c on parent.id=c.corrects_expense_id)select 1 from public.personal_funding_intents owned_funding join chain c on c.id=owned_funding.expense_id where owned_funding.owner_participant_id=actor and owned_funding.status in('posted','reversed'))then raise exception using message='posted_funding_immutable',errcode='P0001';end if;
  if choice_intent is not null then
   select * into f from public.personal_funding_intents where id=choice_intent and owner_participant_id=actor and expense_id=next_id for update;
   if f.id is null or f.status<>'pending' or f.version is distinct from (choice_version+(case when next_id<>e.id then 1 else 0 end)) then raise exception using message='version_conflict',errcode='P0001';end if;
   perform public.cancel_pending_funding(private.money_child_request(request_id,'source-cancel'),f.id);
  elsif exists(select 1 from public.personal_funding_intents owned_funding where owned_funding.expense_id=next_id and owned_funding.owner_participant_id=actor and owned_funding.status='pending')then raise exception using message='version_conflict',errcode='P0001';end if;
  perform public.defer_personal_expense_funding(private.money_child_request(request_id,'source-defer'),next_id,choice_parent,next_version);
 end if;
 return private.finish_money_operation(actor,request_id,jsonb_build_object('expense_id',next_id,'expense_version',next_version,'audience',desired_audience,'trip_id',trip));
end $$;

revoke all on function private.link_personal_trip_expense(uuid,uuid,uuid),private.save_trip_editor_settings(uuid,uuid[],text,jsonb) from public,anon,authenticated;
revoke all on function public.get_trip_expense_editor(uuid),public.save_trip_expense_editor(uuid,uuid,integer,uuid,text,boolean,jsonb,uuid[],text,jsonb,jsonb)from public,anon,authenticated;
grant execute on function public.get_trip_expense_editor(uuid),public.save_trip_expense_editor(uuid,uuid,integer,uuid,text,boolean,jsonb,uuid[],text,jsonb,jsonb)to authenticated;

create function public.create_trip_expense_editor(request_id uuid,target_trip_id uuid,expense_payload jsonb,consumer_ids uuid[],funding_plan jsonb default null,funding_account_id uuid default null,split_mode text default 'exact',items jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();result jsonb;ids uuid[];paid bigint[];shares bigint[];expense uuid;private_candidate boolean;operation_id uuid:=private.money_child_request(request_id,'trip-create-envelope');
begin
 result:=private.begin_money_operation(actor,operation_id,'trip_expense_create',jsonb_build_object('request',request_id,'trip',target_trip_id,'payload',expense_payload,'consumers',consumer_ids,'funding',funding_plan,'legacy_account',funding_account_id,'mode',split_mode,'items',items));if result is not null then return result;end if;
 if not exists(select 1 from public.spaces s where s.id=target_trip_id and s.type='trip' and s.status='active' and private.space_role(s.id,actor)is not null)then raise exception using message='trip_not_accessible',errcode='P0001';end if;
 ids:=array(select jsonb_array_elements_text(expense_payload->'participant_ids')::uuid);paid:=array(select jsonb_array_elements_text(expense_payload->'contribution_amounts')::bigint);shares:=array(select jsonb_array_elements_text(expense_payload->'share_amounts')::bigint);
 perform private.assert_reconciled_expense_payload((expense_payload->>'total_minor')::bigint,ids,paid,shares);
 if consumer_ids is null or cardinality(consumer_ids)=0 then raise exception using message='invalid_consumers',errcode='P0001';end if;
 private_candidate:=not exists(select 1 from unnest(consumer_ids)c where c<>actor)and not exists(select 1 from unnest(ids,paid)x(id,p)where id<>actor and p>0);
 if private_candidate then
  if expense_payload->>'expense_scope' is distinct from 'personal' or cardinality(ids)<>1 or ids[1]<>actor or expense_payload->>'target_space_id' is not null then raise exception using message='private_owner_only',errcode='P0001';end if;
 else
  if expense_payload->>'expense_scope' is distinct from 'space' or(expense_payload->>'target_space_id')::uuid is distinct from target_trip_id or private.space_role(target_trip_id,actor)not in('owner','full_access')then raise exception using message='space_write_denied',errcode='P0001';end if;
 end if;
 if funding_plan is not null then
  result:=public.create_expense_with_multicurrency_funding(request_id,expense_payload,funding_plan);expense:=(result->>'expense_id')::uuid;
 elsif funding_account_id is not null then
  result:=public.create_expense_with_funding(request_id,expense_payload->>'expense_scope',(expense_payload->>'target_space_id')::uuid,(expense_payload->>'total_minor')::bigint,expense_payload->>'currency_code',expense_payload->>'description',expense_payload->>'category',(expense_payload->>'occurred_on')::date,ids,paid,shares,request_id,funding_account_id,null);expense:=(result->>'expense_id')::uuid;
 else
  expense:=public.create_expense(request_id,expense_payload->>'expense_scope',(expense_payload->>'target_space_id')::uuid,(expense_payload->>'total_minor')::bigint,expense_payload->>'currency_code',expense_payload->>'description',expense_payload->>'category',(expense_payload->>'occurred_on')::date,ids,paid,shares);
 end if;
 if private_candidate then perform private.link_personal_trip_expense(actor,expense,target_trip_id);end if;
 perform private.save_trip_editor_settings(expense,consumer_ids,split_mode,items);
 return private.finish_money_operation(actor,operation_id,jsonb_build_object('expense_id',expense,'audience',case when private_candidate then'private'else'shared'end));
end $$;
revoke all on function public.create_trip_expense_editor(uuid,uuid,jsonb,uuid[],jsonb,uuid,text,jsonb)from public,anon,authenticated;
grant execute on function public.create_trip_expense_editor(uuid,uuid,jsonb,uuid[],jsonb,uuid,text,jsonb)to authenticated;

comment on column public.personal_expense_affiliations.trip_id is 'Owner-private stable Trip association; never a membership or read-authority source. Legacy labels stay unbound.';

commit;
