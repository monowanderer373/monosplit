-- COMPLETE FILE: existing Tabby Tally / skiqsxvmxvmxfzhrzcxh only.
-- New003 ONLY; keeps installed001/002 intact. Does not execute Fresh Start.
-- Policy change authorized by user: current login + explicit confirmation, no reauthentication.
-- Migration SHA256 15a8d0c43a5d21a5f87047794ca8ed090b802d81ae0f3a78737346cafed1820f
begin;
set local lock_timeout='10s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tabby.personal-periods.migration',0));
do $tabby_session_confirmation_apply$
declare migration_sql text;
begin
 if(select pg_catalog.array_agg(version order by version)from supabase_migrations.schema_migrations where version<>'202610250003')
 is distinct from array['202608300001','202608300002','202608300003','202608300004','202608300005','202608300006','202608300007','202608300008','202608300009','202608300010','202608300011','202608300012','202609080001','202609210001','202609210002','202609210003','202609210004','202609210005','202609210006','202609210007','202609240001','202610050001','202610090001','202610090002','202610130001','202610130002','20261016130602','20261016132156','202610250001','202610250002']::text[] then
  raise exception 'Unexpected Tabby migration history. Existing001+002 are required.';end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='202610250003')then
  migration_sql:=$tabby_session_confirmation_ddl$-- User-approved policy update: a valid permanent-owner login and explicit
-- confirmation suffice for Fresh Start. No Google/password redirect or recent
-- AMR requirement. All preview/native-opening/locking/idempotence guards remain.
-- Forward migration only; deployed001/002 are immutable. Does not run Reset.
create or replace function public.apply_personal_fresh_start(p_request_id uuid,p_preview_id uuid,p_openings jsonb)returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='30s' as $$
declare actor uuid:=private.require_personal_actor();request_hash text;old public.personal_fresh_start_operations%rowtype;
 preview public.personal_fresh_start_previews%rowtype;snapshot jsonb;old_period uuid;new_period uuid:=gen_random_uuid();instant timestamptz:=clock_timestamp();choice jsonb;unit public.personal_accounts%rowtype;parent public.personal_accounts%rowtype;ids uuid[];opening bigint;result_payload jsonb;anchor uuid;
begin
 if p_request_id is null or p_preview_id is null or p_openings is null or jsonb_typeof(p_openings)<>'array' then raise exception using message='invalid_fresh_start_request',errcode='P0001';end if;
 request_hash:=encode(extensions.digest(jsonb_build_object('preview',p_preview_id,'openings',p_openings)::text,'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended('fresh-start:'||actor::text,0));
 select * into old from public.personal_fresh_start_operations where owner_participant_id=actor and request_id=p_request_id;
 if found then
  if old.status='fenced' then raise exception using message='fresh_start_request_fenced',errcode='P0001';end if;
  if old.payload_fingerprint<>request_hash then raise exception using message='idempotency_conflict',errcode='P0001';end if;
  return old.result;
 end if;
 -- Current authenticated permanent owner + explicit UI confirmation; no extra sign-in.
 -- Existing writers do not share a reset lock. Table locks provide an actual
 -- serialization boundary across expense/funding/journal/scheduler transactions.
 -- Timeout/deadlock aborts atomically; there is no client-only concurrency claim.
 lock table public.expenses,public.expense_participations,public.payer_contributions,public.expense_shares,
 public.settlement_payments,public.settlement_allocations,public.settlement_allocation_reversals,
 public.settlement_payment_requests,public.settlement_attribution_intents,public.personal_settlement_cash_legs,public.recurring_rules,public.recurring_drafts,
 public.direct_expense_change_requests,public.direct_expense_change_approvals,
 public.personal_accounts,public.personal_account_currencies,public.personal_account_transactions,public.personal_account_entries,
 public.personal_funding_intents,public.personal_funding_bundles,public.personal_funding_bundle_legs,public.personal_account_balance_anchors,
 public.personal_money_operations,public.personal_money_movements,public.personal_money_movement_fees,public.personal_money_movement_coverage,
 public.personal_installment_plans,public.personal_installments,public.personal_recurring_rules,public.personal_recurring_occurrences,public.personal_expense_affiliations,
 public.personal_ledger_periods,public.personal_period_expenses,public.personal_period_transactions in share row exclusive mode;
 select * into preview from public.personal_fresh_start_previews where id=p_preview_id and owner_participant_id=actor;
 if not found or preview.expires_at<clock_timestamp() then raise exception using message='fresh_start_preview_expired',errcode='P0001';end if;
 snapshot:=private.personal_period_snapshot(actor);
 if snapshot->>'fingerprint'<>preview.fingerprint then raise exception using message='fresh_start_preview_changed',errcode='P0001';end if;
 if jsonb_array_length(snapshot->'conflicts')<>0 then raise exception using message='fresh_start_review_required',errcode='P0001';end if;
 if jsonb_array_length(p_openings)<>jsonb_array_length(snapshot->'accounts')or(select count(distinct x->>'account_id')from jsonb_array_elements(p_openings)x)<>jsonb_array_length(p_openings)then raise exception using message='fresh_start_openings_incomplete',errcode='P0001';end if;
 if exists(select 1 from jsonb_array_elements(p_openings)x where not exists(select 1 from jsonb_array_elements(snapshot->'accounts')a where a->>'account_id'=x->>'account_id')or x->>'amount_minor' is null or not(x->>'amount_minor'~'^-?[0-9]+$')or(x->>'amount_minor')::numeric not between -9007199254740991 and 9007199254740991)then raise exception using message='invalid_opening_balance',errcode='P0001';end if;
 if exists(select 1 from jsonb_array_elements(p_openings)requested join lateral jsonb_array_elements(snapshot->'accounts')account_snapshot
 on account_snapshot->>'account_id'=requested->>'account_id'
 where(account_snapshot->>'opening_locked')::boolean and(requested->>'amount_minor')::bigint<>(account_snapshot->>'balance_minor')::bigint)then
  raise exception using message='fresh_start_opening_linked_obligation',errcode='P0001';end if;
 instant:=clock_timestamp();
 select id into old_period from public.personal_ledger_periods where owner_participant_id=actor and status='active';
 if old_period is null then
  insert into public.personal_ledger_periods(owner_participant_id,started_at,ended_at,status)
  values(actor,coalesce((select min(created_at)from public.expenses where created_by=actor),instant),instant,'archived')returning id into old_period;
 else update public.personal_ledger_periods set ended_at=instant,status='archived'where id=old_period;end if;
 insert into public.personal_period_expenses(owner_participant_id,period_id,expense_id)select actor,old_period,x::uuid from jsonb_array_elements_text(snapshot->'expense_ids')x;
 insert into public.personal_period_transactions(owner_participant_id,period_id,transaction_id)select actor,old_period,x::uuid from jsonb_array_elements_text(snapshot->'transaction_ids')x;
 insert into public.personal_ledger_periods(id,owner_participant_id,started_at,status)values(new_period,actor,instant,'active');
 for choice in select * from jsonb_array_elements(p_openings)order by value->>'account_id'loop
  select * into unit from public.personal_accounts where id=(choice->>'account_id')::uuid and owner_participant_id=actor;
  select * into parent from public.personal_accounts where id=coalesce((select parent_account_id from public.personal_account_currencies where account_id=unit.id),unit.id);
  opening:=(choice->>'amount_minor')::bigint;
  select coalesce(array_agg(id order by id),'{}')into ids from public.personal_account_entries where account_id=unit.id;
  result_payload:=public.set_personal_currency_balance(private.money_child_request(p_request_id,'fresh-start:'||unit.id::text),unit.id,opening,instant,unit.version,parent.version,ids);
  select id into anchor from public.personal_account_balance_anchors where account_id=unit.id order by anchor_sequence desc limit 1;
  if anchor is null then raise exception using message='fresh_start_anchor_missing',errcode='P0001';end if;
  insert into public.personal_period_openings(owner_participant_id,period_id,account_id,currency,amount_minor,anchor_id)values(actor,new_period,unit.id,unit.currency,opening,anchor);
  -- Baseline/calibration is not a new spending or income activity.
  insert into public.personal_period_transactions(owner_participant_id,period_id,transaction_id)
  select actor,old_period,b.calibration_transaction_id from public.personal_account_balance_anchors b
  where b.id=anchor and b.calibration_transaction_id is not null
  on conflict do nothing;
 end loop;
 result_payload:=jsonb_build_object('schema_version',1,'owner_id',actor,'request_id',p_request_id,'period_id',new_period,'archived_period_id',old_period,'completed_at',instant,'authentication_method','session','policy','carry_all');
 insert into public.personal_fresh_start_operations(owner_participant_id,request_id,status,payload_fingerprint,result)values(actor,p_request_id,'committed',request_hash,result_payload);
 return result_payload;
end $$;


create or replace function public.get_personal_ledger_period_state()returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();begin
 return jsonb_build_object('schema_version',1,'opening_safety_version',2,'fresh_start_confirmation_version',1,'owner_id',actor,
 'periods',coalesce((select jsonb_agg(jsonb_build_object('id',id,'started_at',started_at,'ended_at',ended_at,'status',status)order by started_at desc,id)from public.personal_ledger_periods where owner_participant_id=actor),'[]'),
 'archived_expense_ids',coalesce((select jsonb_agg(m.expense_id order by m.expense_id)from public.personal_period_expenses m join public.personal_ledger_periods p on p.id=m.period_id where m.owner_participant_id=actor and p.status='archived'),'[]'),
 'archived_transaction_ids',coalesce((select jsonb_agg(m.transaction_id order by m.transaction_id)from public.personal_period_transactions m join public.personal_ledger_periods p on p.id=m.period_id where m.owner_participant_id=actor and p.status='archived'),'[]'),
 'later_funding',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'account_id',a.id,'account_name',a.name,'expense_id',t.expense_id,'occurred_on',t.occurred_on,'created_at',t.created_at,'currency',e.currency,'amount_minor',e.amount_minor::text,'memo',t.memo)order by t.id,a.id)
 from public.personal_account_transactions t join public.personal_account_entries e on e.transaction_id=t.id join public.personal_accounts a on a.id=e.account_id
 join public.personal_period_expenses m on m.expense_id=t.expense_id and m.owner_participant_id=actor
 join public.personal_ledger_periods p on p.id=m.period_id and p.status='archived'
 join public.expenses x on x.id=t.expense_id and x.scope='personal'
 where t.owner_participant_id=actor and a.owner_participant_id=actor and t.kind in('expense_funding','liability_purchase')
 and not exists(select 1 from public.personal_period_transactions z where z.owner_participant_id=actor and z.transaction_id=t.id)),'[]'));
end $$;

revoke all on function public.apply_personal_fresh_start(uuid,uuid,jsonb),public.get_personal_ledger_period_state()from public,anon;
grant execute on function public.apply_personal_fresh_start(uuid,uuid,jsonb),public.get_personal_ledger_period_state()to authenticated;
notify pgrst,'reload schema';
$tabby_session_confirmation_ddl$;
  execute migration_sql;
  insert into supabase_migrations.schema_migrations(version,name,statements)values('202610250003','personal_period_session_confirmation',array[migration_sql]);
 end if;
 if pg_catalog.to_regprocedure('private.personal_period_opening_locks(uuid)')is null
 or pg_catalog.strpos(pg_catalog.pg_get_functiondef('public.get_personal_ledger_period_state()'::regprocedure),'fresh_start_confirmation_version')=0
 or pg_catalog.strpos(pg_catalog.pg_get_functiondef('public.apply_personal_fresh_start(uuid,uuid,jsonb)'::regprocedure),'fresh_start_reauthentication_required')<>0
 or not pg_catalog.has_function_privilege('authenticated','public.apply_personal_fresh_start(uuid,uuid,jsonb)','EXECUTE')
 or pg_catalog.has_function_privilege('anon','public.apply_personal_fresh_start(uuid,uuid,jsonb)','EXECUTE')then
  raise exception 'Session confirmation safeguards are incomplete.';end if;
 if(select pg_catalog.encode(extensions.digest(pg_catalog.replace(prosrc,pg_catalog.chr(13)||pg_catalog.chr(10),pg_catalog.chr(10)),'sha256'),'hex')from pg_catalog.pg_proc where oid='public.apply_personal_fresh_start(uuid,uuid,jsonb)'::regprocedure)is distinct from '3de740166a999eec6617416844ca439f88e6989c8844ad134437b8d1b9a740d8'then raise exception 'Unexpected session-confirmation function body.';end if;
 if(select pg_catalog.encode(extensions.digest(pg_catalog.replace(prosrc,pg_catalog.chr(13)||pg_catalog.chr(10),pg_catalog.chr(10)),'sha256'),'hex')from pg_catalog.pg_proc where oid='public.get_personal_ledger_period_state()'::regprocedure)is distinct from 'de6c82926231f0bf3095516c1013ba7bde91e2ae9efe554b4de8c93546942345'then raise exception 'Unexpected session-confirmation function body.';end if;
end $tabby_session_confirmation_apply$;
notify pgrst,'reload schema';
commit;
select 'TABBY_FRESH_START_SESSION_CONFIRMATION_COMPLETE_20261025' as result;
-- END OF COMPLETE FILE
