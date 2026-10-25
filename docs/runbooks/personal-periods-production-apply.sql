-- COMPLETE FILE V2: existing Tabby Tally / Supabase skiqsxvmxvmxfzhrzcxh only.
-- Installs capability AND linked-obligation opening guards.
-- This does NOT execute Fresh Start, reset balances or modify financial facts.
-- Original001 is preserved. An already installed001 is skipped safely.
begin;
set local lock_timeout='10s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tabby.personal-periods.migration',0));
do $tabby_personal_periods_apply$
declare migration_sql text;
begin
 if(select pg_catalog.array_agg(version order by version)from supabase_migrations.schema_migrations where version not in('202610250001','202610250002'))
 is distinct from array['202608300001','202608300002','202608300003','202608300004','202608300005','202608300006','202608300007','202608300008','202608300009','202608300010','202608300011','202608300012','202609080001','202609210001','202609210002','202609210003','202609210004','202609210005','202609210006','202609210007','202609240001','202610050001','202610090001','202610090002','202610130001','202610130002','20261016130602','20261016132156']::text[] then
  raise exception 'Unexpected Tabby migration history. Stop and verify existing project.';end if;
 if exists(select 1 from supabase_migrations.schema_migrations where version='202610250002')and not exists(select 1 from supabase_migrations.schema_migrations where version='202610250001')then
  raise exception 'Incomplete personal-period migration history.';end if;

 -- 202610250001_personal_ledger_periods.sql SHA256 1031b94e9e7b47b64e61433e411f454252b48f8ebb27d843ef0762d60fb86e4d
 if not exists(select 1 from supabase_migrations.schema_migrations where version='202610250001')then
  migration_sql:=$tabby_personal_periods_ddl_0$-- Owner reporting periods. Source expenses, identities, allocations and native
-- journals are never deleted/relabelled. Opening choices compose existing
-- versioned native reconciliation/coverage commands in ONE transaction.
create table public.personal_ledger_periods (
 id uuid primary key default gen_random_uuid(),owner_participant_id uuid not null references public.participants(id),
 started_at timestamptz not null,ended_at timestamptz,status text not null check(status in('active','archived')),
 created_at timestamptz not null default now(),unique(id,owner_participant_id),
 check((status='active' and ended_at is null)or(status='archived' and ended_at is not null and ended_at>=started_at))
);
create unique index personal_period_one_active on public.personal_ledger_periods(owner_participant_id) where status='active';
create table public.personal_period_expenses (
 owner_participant_id uuid not null references public.participants(id),period_id uuid not null,expense_id uuid not null references public.expenses(id),
 primary key(owner_participant_id,expense_id),foreign key(period_id,owner_participant_id) references public.personal_ledger_periods(id,owner_participant_id)
);
create table public.personal_period_transactions (
 owner_participant_id uuid not null references public.participants(id),period_id uuid not null,transaction_id uuid not null references public.personal_account_transactions(id),
 primary key(owner_participant_id,transaction_id),foreign key(period_id,owner_participant_id) references public.personal_ledger_periods(id,owner_participant_id)
);
create table public.personal_period_openings (
 owner_participant_id uuid not null references public.participants(id),period_id uuid not null,account_id uuid not null references public.personal_accounts(id),
 currency text not null,amount_minor bigint not null check(amount_minor between -9007199254740991 and 9007199254740991),anchor_id uuid not null references public.personal_account_balance_anchors(id),
 primary key(period_id,account_id),foreign key(period_id,owner_participant_id) references public.personal_ledger_periods(id,owner_participant_id)
);
create table public.personal_fresh_start_previews (
 id uuid primary key default gen_random_uuid(),owner_participant_id uuid not null references public.participants(id),
 fingerprint text not null,payload jsonb not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes'
);
create table public.personal_fresh_start_operations (
 owner_participant_id uuid not null references public.participants(id),request_id uuid not null,
 status text not null check(status in('committed','fenced')),payload_fingerprint text,result jsonb,
 created_at timestamptz not null default now(),primary key(owner_participant_id,request_id),
 check((status='committed' and result is not null and payload_fingerprint is not null)or(status='fenced' and result is null))
);
do $$ declare t text;begin
 foreach t in array array['personal_ledger_periods','personal_period_expenses','personal_period_transactions','personal_period_openings','personal_fresh_start_previews','personal_fresh_start_operations']loop
  execute pg_catalog.format('alter table public.%I enable row level security',t);
  execute pg_catalog.format('revoke all on table public.%I from public,anon,authenticated',t);
  execute pg_catalog.format('grant select on table public.%I to authenticated',t);
  execute pg_catalog.format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) is not null and owner_participant_id=(select public.current_participant_id()))',t||'_owner',t);
 end loop;
end $$;

-- One authoritative snapshot, including the full correction/reference graph.
-- A component touching a second principal is protected in its entirety.
create function private.personal_period_snapshot(actor uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare protected_ids uuid[];personal_ids uuid[];tx_ids uuid[];protected_tx uuid[];visible_ids uuid[];payment_ids uuid[];
 pieces jsonb:='{}'::jsonb;part jsonb;accounts jsonb;amounts jsonb;conflicts jsonb:='[]'::jsonb;
begin
 select coalesce(array_agg(id order by id),'{}') into visible_ids from public.expenses e where private.can_read_expense(e.id,actor);
 with recursive edges(a,b)as(
  select id,corrects_expense_id from public.expenses where corrects_expense_id is not null
  union all select corrects_expense_id,id from public.expenses where corrects_expense_id is not null
 ),protected(id)as(
  select e.id from public.expenses e where e.id=any(visible_ids) and(e.scope<>'personal' or e.created_by<>actor or e.participant_count<>1
    or exists(select 1 from public.expense_participations p where p.expense_id=e.id and p.participant_id<>actor)
    or exists(select 1 from public.settlement_attribution_intents a where a.expense_id=e.id))
  union select edges.b from edges join protected on edges.a=protected.id
 )select coalesce(array_agg(id order by id),'{}') into protected_ids from protected;
 select coalesce(array_agg(e.id order by e.id),'{}') into personal_ids from public.expenses e
 where e.created_by=actor and e.scope='personal' and not(e.id=any(protected_ids))
 and exists(select 1 from public.expense_participations p where p.expense_id=e.id and p.participant_id=actor)
 and not exists(select 1 from public.personal_period_expenses m where m.owner_participant_id=actor and m.expense_id=e.id);
 with recursive edges(a,b)as(
  select id,reverses_transaction_id from public.personal_account_transactions where reverses_transaction_id is not null
  union all select reverses_transaction_id,id from public.personal_account_transactions where reverses_transaction_id is not null
 ),protected(id)as(
  select id from public.personal_account_transactions where owner_participant_id=actor
   and(settlement_allocation_id is not null or kind in('settlement_in','settlement_out')or expense_id=any(protected_ids))
  union select edges.b from edges join protected on edges.a=protected.id
 )select coalesce(array_agg(id order by id),'{}') into protected_tx from protected;
 select coalesce(array_agg(t.id order by t.id),'{}') into tx_ids from public.personal_account_transactions t
 where t.owner_participant_id=actor and not(t.id=any(protected_tx))
 and not exists(select 1 from public.personal_period_transactions m where m.owner_participant_id=actor and m.transaction_id=t.id);
 -- Unknown future journal types must be audited, never silently classified.
 if exists(select 1 from public.personal_account_transactions where owner_participant_id=actor and kind not in(
 'opening','reconciliation','income','refund','expense_funding','transfer','liability_purchase','liability_repayment','interest_fee','settlement_out','settlement_in','gift_out','gift_in','reversal'))then
 conflicts:=conflicts||'"unknown_journal_kind"'::jsonb;end if;
 select coalesce(array_agg(id order by id),'{}') into payment_ids from public.settlement_payments p where private.can_read_settlement(p.id,actor);
 select coalesce(jsonb_agg(to_jsonb(e)order by e.id),'[]') into part from public.expenses e where e.id=any(visible_ids);pieces:=pieces||jsonb_build_object('expenses',part);
 select coalesce(jsonb_agg(to_jsonb(p)order by p.id),'[]') into part from public.expense_participations p where p.expense_id=any(visible_ids);pieces:=pieces||jsonb_build_object('participations',part);
 select coalesce(jsonb_agg(to_jsonb(p)order by to_jsonb(p)::text),'[]') into part from public.payer_contributions p where p.expense_id=any(visible_ids);pieces:=pieces||jsonb_build_object('contributions',part);
 select coalesce(jsonb_agg(to_jsonb(p)order by to_jsonb(p)::text),'[]') into part from public.expense_shares p where p.expense_id=any(visible_ids);pieces:=pieces||jsonb_build_object('shares',part);
 select coalesce(jsonb_agg(to_jsonb(p)order by p.id),'[]') into part from public.settlement_payments p where p.id=any(payment_ids);pieces:=pieces||jsonb_build_object('payments',part);
 select coalesce(jsonb_agg(to_jsonb(p)order by p.id),'[]') into part from public.settlement_allocations p where p.settlement_payment_id=any(payment_ids);pieces:=pieces||jsonb_build_object('allocations',part);
 select coalesce(jsonb_agg(to_jsonb(p)order by to_jsonb(p)::text),'[]') into part from public.settlement_allocation_reversals p where private.can_read_settlement_reversal(p.id,actor);pieces:=pieces||jsonb_build_object('reversals',part);
 pieces:=pieces||jsonb_build_object(
  'personal_accounts',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_accounts x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_account_transactions',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_account_transactions x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_account_currencies',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_account_currencies x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_account_balance_anchors',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_account_balance_anchors x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_money_operations',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_money_operations x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_funding_intents',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_funding_intents x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_funding_bundles',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_funding_bundles x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_funding_bundle_legs',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_funding_bundle_legs x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_money_movements',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_money_movements x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_money_movement_fees',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_money_movement_fees x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_money_movement_coverage',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_money_movement_coverage x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_installment_plans',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_installment_plans x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_installments',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_installments x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_recurring_rules',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_recurring_rules x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_recurring_occurrences',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_recurring_occurrences x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_expense_affiliations',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_expense_affiliations x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_settlement_cash_legs',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_settlement_cash_legs x where x.owner_participant_id=actor),'[]'::jsonb),
  'recurring_rules',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.recurring_rules x where x.owner_participant_id=actor),'[]'::jsonb),
  'recurring_drafts',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.recurring_drafts x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_ledger_periods',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_ledger_periods x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_period_expenses',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_period_expenses x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_period_transactions',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_period_transactions x where x.owner_participant_id=actor),'[]'::jsonb));
 select coalesce(jsonb_agg(to_jsonb(x)order by x.id),'[]') into part from public.settlement_payment_requests x where actor in(x.creditor_participant_id,x.debtor_participant_id);pieces:=pieces||jsonb_build_object('payment_requests',part);
 select coalesce(jsonb_agg(to_jsonb(x)order by x.id),'[]') into part from public.settlement_attribution_intents x where x.settlement_payment_id=any(payment_ids);pieces:=pieces||jsonb_build_object('attribution',part);
 select coalesce(jsonb_agg(to_jsonb(x)order by x.id),'[]') into part from public.personal_account_entries x join public.personal_accounts a on a.id=x.account_id where a.owner_participant_id=actor;
 pieces:=pieces||jsonb_build_object('entries',part);
 select coalesce(jsonb_agg(to_jsonb(x)order by x.id),'[]') into part from public.direct_expense_change_requests x where x.target_expense_id=any(visible_ids)or x.replacement_expense_id=any(visible_ids);pieces:=pieces||jsonb_build_object('changes',part);
 select coalesce(jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text),'[]') into part from public.direct_expense_change_approvals x join public.direct_expense_change_requests q on q.id=x.request_id where q.target_expense_id=any(visible_ids)or q.replacement_expense_id=any(visible_ids);pieces:=pieces||jsonb_build_object('approvals',part);
 select coalesce(jsonb_agg(jsonb_build_object('account_id',a.id,'parent_id',coalesce(c.parent_account_id,a.id),'name',p.name,'currency',a.currency,'account_class',a.account_class,'account_type',a.account_type,
  'known',a.opening_status='posted','balance_minor',coalesce((select sum(e.amount_minor)from public.personal_account_entries e where e.account_id=a.id),0)::text,
  'version',a.version,'parent_version',p.version)order by p.id,a.currency,a.id),'[]') into accounts
 from public.personal_accounts a left join public.personal_account_currencies c on c.account_id=a.id join public.personal_accounts p on p.id=coalesce(c.parent_account_id,a.id)
 where a.owner_participant_id=actor and p.owner_participant_id=actor and a.archived_at is null and p.archived_at is null;
 select coalesce(jsonb_agg(jsonb_build_object('currency',currency,'amount_minor',amount::text)order by currency),'[]')into amounts from(
  select currency,sum(total_minor)amount from public.expenses where id=any(personal_ids) and status<>'voided'group by currency
 )a;
 return jsonb_build_object('fingerprint',encode(extensions.digest(pieces::text,'sha256'),'hex'),'expense_ids',to_jsonb(personal_ids),'transaction_ids',to_jsonb(tx_ids),
  'accounts',accounts,'currencies',amounts,'personal_count',cardinality(personal_ids),'protected_shared_count',(select count(*)from unnest(protected_ids)x where x=any(visible_ids)),'protected_settlement_count',cardinality(payment_ids),
  'pending_funding_count',(select count(*)from public.personal_funding_intents where owner_participant_id=actor and status='pending'),
  'ongoing_installment_count',(select count(*)from public.personal_installment_plans where owner_participant_id=actor and status in('pending_principal','active')),
  'recurring_rule_count',(select count(*)from public.personal_recurring_rules where owner_participant_id=actor),'policy','carry_all','conflicts',conflicts);
end $$;
revoke all on function private.personal_period_snapshot(uuid) from public,anon,authenticated;

create function public.get_personal_ledger_period_state()returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();begin
 return jsonb_build_object('schema_version',1,'owner_id',actor,
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

create function public.preview_personal_fresh_start()returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();snapshot jsonb;preview_id uuid:=gen_random_uuid();expiry timestamptz:=clock_timestamp()+interval'15 minutes';begin
 snapshot:=private.personal_period_snapshot(actor);
 insert into public.personal_fresh_start_previews(id,owner_participant_id,fingerprint,payload,expires_at)values(preview_id,actor,snapshot->>'fingerprint',snapshot,expiry);
 return (snapshot-'expense_ids'-'transaction_ids')||jsonb_build_object('id',preview_id,'owner_id',actor,'expires_at',expiry,'schema_version',1);
end $$;

create function public.get_personal_fresh_start_preview(p_preview_id uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();p public.personal_fresh_start_previews%rowtype;begin
 select * into p from public.personal_fresh_start_previews where id=p_preview_id and owner_participant_id=actor;
 if not found or p.expires_at<statement_timestamp() then raise exception using message='fresh_start_preview_expired',errcode='P0001';end if;
 return(p.payload-'expense_ids'-'transaction_ids')||jsonb_build_object('id',p.id,'owner_id',actor,'expires_at',p.expires_at,'schema_version',1);
end $$;

create function public.apply_personal_fresh_start(p_request_id uuid,p_preview_id uuid,p_openings jsonb)returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='30s' as $$
declare actor uuid:=private.require_personal_actor();request_hash text;old public.personal_fresh_start_operations%rowtype;
 preview public.personal_fresh_start_previews%rowtype;snapshot jsonb;old_period uuid;new_period uuid:=gen_random_uuid();instant timestamptz:=clock_timestamp();choice jsonb;unit public.personal_accounts%rowtype;parent public.personal_accounts%rowtype;ids uuid[];opening bigint;result_payload jsonb;anchor uuid;method text;
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
 -- iat changes on refresh; only a signed authentication-method timestamp proves recent sign-in.
 select x->>'method' into method from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'))x
 where x->>'method' in('password','oauth','otp','sso/saml')and x->>'timestamp'~'^[0-9]+$'
 and (x->>'timestamp')::numeric between extract(epoch from clock_timestamp())-300 and extract(epoch from clock_timestamp())+30 order by(x->>'timestamp')::numeric desc limit 1;
 if method is null then raise exception using message='fresh_start_reauthentication_required',errcode='P0001';end if;
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
 result_payload:=jsonb_build_object('schema_version',1,'owner_id',actor,'request_id',p_request_id,'period_id',new_period,'archived_period_id',old_period,'completed_at',instant,'authentication_method',method,'policy','carry_all');
 insert into public.personal_fresh_start_operations(owner_participant_id,request_id,status,payload_fingerprint,result)values(actor,p_request_id,'committed',request_hash,result_payload);
 return result_payload;
end $$;

-- Reconciliation fences a request which has not committed. A delayed original
-- request can never post after the user has safely moved to a different review.
create function public.reconcile_personal_fresh_start(p_request_id uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();receipt public.personal_fresh_start_operations%rowtype;begin
 if p_request_id is null then raise exception using message='invalid_request_id',errcode='P0001';end if;
 perform pg_advisory_xact_lock(hashtextextended('fresh-start:'||actor::text,0));
 select * into receipt from public.personal_fresh_start_operations where owner_participant_id=actor and request_id=p_request_id;
 if found and receipt.status='committed'then return jsonb_build_object('state','committed','result',receipt.result);end if;
 insert into public.personal_fresh_start_operations(owner_participant_id,request_id,status)values(actor,p_request_id,'fenced')on conflict do nothing;
 return jsonb_build_object('state','fenced');
end $$;

create function public.get_personal_ledger_archive(p_period_id uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();period public.personal_ledger_periods%rowtype;begin
 select * into period from public.personal_ledger_periods where id=p_period_id and owner_participant_id=actor and status='archived';
 if not found then raise exception using message='personal_archive_unavailable',errcode='P0001';end if;
 return jsonb_build_object('schema_version',1,'period',to_jsonb(period),
 'expenses',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'description',e.description,'category',e.category,'occurred_on',e.occurred_on,'currency',e.currency,'total_minor',e.total_minor::text,'status',e.status,'corrects_expense_id',e.corrects_expense_id)order by e.occurred_on desc,e.id)
 from public.personal_period_expenses m join public.expenses e on e.id=m.expense_id where m.owner_participant_id=actor and m.period_id=period.id and e.scope='personal' and private.can_read_expense(e.id,actor)),'[]'),
 'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'account_id',a.id,'account_name',a.name,'kind',t.kind,'occurred_on',t.occurred_on,'memo',t.memo,'currency',e.currency,'amount_minor',e.amount_minor::text)order by t.occurred_on desc,t.id,a.id)
 from public.personal_period_transactions m join public.personal_account_transactions t on t.id=m.transaction_id
 join public.personal_account_entries e on e.transaction_id=t.id join public.personal_accounts a on a.id=e.account_id
 where m.owner_participant_id=actor and m.period_id=period.id and t.owner_participant_id=actor and a.owner_participant_id=actor),'[]'),
 'openings',coalesce((select jsonb_agg(jsonb_build_object('account_id',o.account_id,'currency',o.currency,'amount_minor',o.amount_minor::text)order by o.account_id)from public.personal_period_openings o where o.owner_participant_id=actor and o.period_id=period.id),'[]'));
end $$;

-- Future personal corrections of archived personal history stay in that period;
-- a transition touching Shared/Space is never hidden from active financial views.
create function private.inherit_personal_period()returns trigger language plpgsql security definer set search_path='' as $$
declare period uuid;begin
 if new.scope<>'personal'or new.corrects_expense_id is null then return new;end if;
 if exists(with recursive ancestors(id,scope,created_by,parent)as(
  select e.id,e.scope,e.created_by,e.corrects_expense_id from public.expenses e where e.id=new.corrects_expense_id
  union select e.id,e.scope,e.created_by,e.corrects_expense_id from public.expenses e join ancestors a on e.id=a.parent
 )select 1 from ancestors where scope<>'personal'or created_by<>new.created_by)then return new;end if;
 select m.period_id into period from public.personal_period_expenses m where m.owner_participant_id=new.created_by and m.expense_id=new.corrects_expense_id;
 if period is not null then insert into public.personal_period_expenses(owner_participant_id,period_id,expense_id)values(new.created_by,period,new.id)on conflict do nothing;end if;
 return new;
end $$;
revoke all on function private.inherit_personal_period()from public,anon,authenticated;
create trigger personal_period_correction_membership after insert or update of corrects_expense_id,scope on public.expenses for each row execute function private.inherit_personal_period();

do $$declare f text;begin
 foreach f in array array['get_personal_ledger_period_state()','preview_personal_fresh_start()','get_personal_fresh_start_preview(uuid)','apply_personal_fresh_start(uuid,uuid,jsonb)','reconcile_personal_fresh_start(uuid)','get_personal_ledger_archive(uuid)']loop
  execute 'revoke all on function public.'||f||' from public,anon';
  execute 'grant execute on function public.'||f||' to authenticated';
 end loop;
end $$;
notify pgrst,'reload schema';
-- Owner-period invalidation; old tables/financial publication remain intact.
do $$begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'and schemaname='public'and tablename='personal_ledger_periods')then
  alter publication supabase_realtime add table public.personal_ledger_periods;
 end if;
end $$;
$tabby_personal_periods_ddl_0$;
  execute migration_sql;
  insert into supabase_migrations.schema_migrations(version,name,statements)values('202610250001','personal_ledger_periods',array[migration_sql]);
 end if;

 -- 202610250002_personal_period_opening_safety.sql SHA256 2d72721ea61b7a3fba5d79c56623d158dd6bf3d8e42cbd36ed03253b3229e2ed
 if not exists(select 1 from supabase_migrations.schema_migrations where version='202610250002')then
  migration_sql:=$tabby_personal_periods_ddl_1$-- Forward hardening: preserve the first installed migration verbatim.
-- Pending shared cash, active installment principals/repayment accounts, and
-- due/unposted recurring cash cannot safely infer inclusion in a new observed
-- balance. Keep the recorded native balance; continue original workflows.
-- This installs guards only. It does NOT run Fresh Start or modify source facts.
create function private.personal_period_opening_locks(actor uuid)returns jsonb
language sql stable security definer set search_path='' as $$
 with pending_shared as(
  select 1 from public.settlement_payments p join public.settlement_allocations a on a.settlement_payment_id=p.id
  where p.cash_tracking_required and a.state='pending'and actor in(p.debtor_participant_id,a.creditor_participant_id)
 ),locked(account_id)as(
  select a.id from public.personal_accounts a where a.owner_participant_id=actor and exists(select 1 from pending_shared)
  union select p.liability_account_id from public.personal_installment_plans p where p.owner_participant_id=actor and p.status='active'
  union select p.repayment_account_id from public.personal_installment_plans p where p.owner_participant_id=actor and p.status='active'
  union select c.account_id from public.personal_settlement_cash_legs c where c.owner_participant_id=actor and c.status='pending'
  union select coalesce(o.effective_account_id,r.funding_account_id)from public.personal_recurring_occurrences o join public.personal_recurring_rules r on r.id=o.rule_id
   where o.owner_participant_id=actor and o.status in('pending_review','failed')
  union select r.funding_account_id from public.personal_recurring_rules r where r.owner_participant_id=actor and not r.paused
   and r.next_due_on<=(now()at time zone r.timezone)::date
 )select coalesce(jsonb_agg(account_id order by account_id),'[]'::jsonb)from locked where account_id is not null
$$;
revoke all on function private.personal_period_opening_locks(uuid)from public,anon,authenticated;

create or replace function private.personal_period_snapshot(actor uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare protected_ids uuid[];personal_ids uuid[];tx_ids uuid[];protected_tx uuid[];visible_ids uuid[];payment_ids uuid[];
 pieces jsonb:='{}'::jsonb;part jsonb;accounts jsonb;amounts jsonb;locked_openings jsonb;conflicts jsonb:='[]'::jsonb;
begin
 select coalesce(array_agg(id order by id),'{}') into visible_ids from public.expenses e where private.can_read_expense(e.id,actor);
 with recursive edges(a,b)as(
  select id,corrects_expense_id from public.expenses where corrects_expense_id is not null
  union all select corrects_expense_id,id from public.expenses where corrects_expense_id is not null
 ),protected(id)as(
  select e.id from public.expenses e where e.id=any(visible_ids) and(e.scope<>'personal' or e.created_by<>actor or e.participant_count<>1
    or exists(select 1 from public.expense_participations p where p.expense_id=e.id and p.participant_id<>actor)
    or exists(select 1 from public.settlement_attribution_intents a where a.expense_id=e.id))
  union select edges.b from edges join protected on edges.a=protected.id
 )select coalesce(array_agg(id order by id),'{}') into protected_ids from protected;
 select coalesce(array_agg(e.id order by e.id),'{}') into personal_ids from public.expenses e
 where e.created_by=actor and e.scope='personal' and not(e.id=any(protected_ids))
 and exists(select 1 from public.expense_participations p where p.expense_id=e.id and p.participant_id=actor)
 and not exists(select 1 from public.personal_period_expenses m where m.owner_participant_id=actor and m.expense_id=e.id);
 with recursive edges(a,b)as(
  select id,reverses_transaction_id from public.personal_account_transactions where reverses_transaction_id is not null
  union all select reverses_transaction_id,id from public.personal_account_transactions where reverses_transaction_id is not null
 ),protected(id)as(
  select id from public.personal_account_transactions where owner_participant_id=actor
   and(settlement_allocation_id is not null or kind in('settlement_in','settlement_out')or expense_id=any(protected_ids))
  union select edges.b from edges join protected on edges.a=protected.id
 )select coalesce(array_agg(id order by id),'{}') into protected_tx from protected;
 select coalesce(array_agg(t.id order by t.id),'{}') into tx_ids from public.personal_account_transactions t
 where t.owner_participant_id=actor and not(t.id=any(protected_tx))
 and not exists(select 1 from public.personal_period_transactions m where m.owner_participant_id=actor and m.transaction_id=t.id);
 -- Unknown future journal types must be audited, never silently classified.
 if exists(select 1 from public.personal_account_transactions where owner_participant_id=actor and kind not in(
 'opening','reconciliation','income','refund','expense_funding','transfer','liability_purchase','liability_repayment','interest_fee','settlement_out','settlement_in','gift_out','gift_in','reversal'))then
 conflicts:=conflicts||'"unknown_journal_kind"'::jsonb;end if;
 select coalesce(array_agg(id order by id),'{}') into payment_ids from public.settlement_payments p where private.can_read_settlement(p.id,actor);
 select coalesce(jsonb_agg(to_jsonb(e)order by e.id),'[]') into part from public.expenses e where e.id=any(visible_ids);pieces:=pieces||jsonb_build_object('expenses',part);
 select coalesce(jsonb_agg(to_jsonb(p)order by p.id),'[]') into part from public.expense_participations p where p.expense_id=any(visible_ids);pieces:=pieces||jsonb_build_object('participations',part);
 select coalesce(jsonb_agg(to_jsonb(p)order by to_jsonb(p)::text),'[]') into part from public.payer_contributions p where p.expense_id=any(visible_ids);pieces:=pieces||jsonb_build_object('contributions',part);
 select coalesce(jsonb_agg(to_jsonb(p)order by to_jsonb(p)::text),'[]') into part from public.expense_shares p where p.expense_id=any(visible_ids);pieces:=pieces||jsonb_build_object('shares',part);
 select coalesce(jsonb_agg(to_jsonb(p)order by p.id),'[]') into part from public.settlement_payments p where p.id=any(payment_ids);pieces:=pieces||jsonb_build_object('payments',part);
 select coalesce(jsonb_agg(to_jsonb(p)order by p.id),'[]') into part from public.settlement_allocations p where p.settlement_payment_id=any(payment_ids);pieces:=pieces||jsonb_build_object('allocations',part);
 select coalesce(jsonb_agg(to_jsonb(p)order by to_jsonb(p)::text),'[]') into part from public.settlement_allocation_reversals p where private.can_read_settlement_reversal(p.id,actor);pieces:=pieces||jsonb_build_object('reversals',part);
 pieces:=pieces||jsonb_build_object(
  'personal_accounts',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_accounts x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_account_transactions',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_account_transactions x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_account_currencies',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_account_currencies x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_account_balance_anchors',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_account_balance_anchors x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_money_operations',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_money_operations x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_funding_intents',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_funding_intents x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_funding_bundles',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_funding_bundles x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_funding_bundle_legs',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_funding_bundle_legs x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_money_movements',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_money_movements x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_money_movement_fees',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_money_movement_fees x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_money_movement_coverage',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_money_movement_coverage x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_installment_plans',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_installment_plans x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_installments',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_installments x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_recurring_rules',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_recurring_rules x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_recurring_occurrences',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_recurring_occurrences x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_expense_affiliations',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_expense_affiliations x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_settlement_cash_legs',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_settlement_cash_legs x where x.owner_participant_id=actor),'[]'::jsonb),
  'recurring_rules',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.recurring_rules x where x.owner_participant_id=actor),'[]'::jsonb),
  'recurring_drafts',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.recurring_drafts x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_ledger_periods',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_ledger_periods x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_period_expenses',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_period_expenses x where x.owner_participant_id=actor),'[]'::jsonb),
  'personal_period_transactions',coalesce((select jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text)from public.personal_period_transactions x where x.owner_participant_id=actor),'[]'::jsonb));
 select coalesce(jsonb_agg(to_jsonb(x)order by x.id),'[]') into part from public.settlement_payment_requests x where actor in(x.creditor_participant_id,x.debtor_participant_id);pieces:=pieces||jsonb_build_object('payment_requests',part);
 select coalesce(jsonb_agg(to_jsonb(x)order by x.id),'[]') into part from public.settlement_attribution_intents x where x.settlement_payment_id=any(payment_ids);pieces:=pieces||jsonb_build_object('attribution',part);
 select coalesce(jsonb_agg(to_jsonb(x)order by x.id),'[]') into part from public.personal_account_entries x join public.personal_accounts a on a.id=x.account_id where a.owner_participant_id=actor;
 pieces:=pieces||jsonb_build_object('entries',part);
 select coalesce(jsonb_agg(to_jsonb(x)order by x.id),'[]') into part from public.direct_expense_change_requests x where x.target_expense_id=any(visible_ids)or x.replacement_expense_id=any(visible_ids);pieces:=pieces||jsonb_build_object('changes',part);
 select coalesce(jsonb_agg(to_jsonb(x)order by to_jsonb(x)::text),'[]') into part from public.direct_expense_change_approvals x join public.direct_expense_change_requests q on q.id=x.request_id where q.target_expense_id=any(visible_ids)or q.replacement_expense_id=any(visible_ids);pieces:=pieces||jsonb_build_object('approvals',part);
 locked_openings:=private.personal_period_opening_locks(actor);
 select coalesce(jsonb_agg(jsonb_build_object('account_id',a.id,'parent_id',coalesce(c.parent_account_id,a.id),'name',p.name,'currency',a.currency,'account_class',a.account_class,'account_type',a.account_type,
  'opening_locked',locked_openings ? a.id::text,'known',a.opening_status='posted','balance_minor',coalesce((select sum(e.amount_minor)from public.personal_account_entries e where e.account_id=a.id),0)::text,
  'version',a.version,'parent_version',p.version)order by p.id,a.currency,a.id),'[]') into accounts
 from public.personal_accounts a left join public.personal_account_currencies c on c.account_id=a.id join public.personal_accounts p on p.id=coalesce(c.parent_account_id,a.id)
 where a.owner_participant_id=actor and p.owner_participant_id=actor and a.archived_at is null and p.archived_at is null;
 if exists(select 1 from jsonb_array_elements(accounts)x where (x->>'opening_locked')::boolean and not(x->>'known')::boolean)then
  conflicts:=conflicts||'"linked_obligation_unknown_balance"'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('currency',currency,'amount_minor',amount::text)order by currency),'[]')into amounts from(
  select currency,sum(total_minor)amount from public.expenses where id=any(personal_ids) and status<>'voided'group by currency
 )a;
 return jsonb_build_object('fingerprint',encode(extensions.digest(pieces::text,'sha256'),'hex'),'expense_ids',to_jsonb(personal_ids),'transaction_ids',to_jsonb(tx_ids),
  'accounts',accounts,'currencies',amounts,'personal_count',cardinality(personal_ids),'protected_shared_count',(select count(*)from unnest(protected_ids)x where x=any(visible_ids)),'protected_settlement_count',cardinality(payment_ids),
  'pending_funding_count',(select count(*)from public.personal_funding_intents where owner_participant_id=actor and status='pending'),
  'ongoing_installment_count',(select count(*)from public.personal_installment_plans where owner_participant_id=actor and status in('pending_principal','active')),
  'recurring_rule_count',(select count(*)from public.personal_recurring_rules where owner_participant_id=actor),'policy','carry_all','conflicts',conflicts);
end $$;
revoke all on function private.personal_period_snapshot(uuid) from public,anon,authenticated;

create or replace function public.apply_personal_fresh_start(p_request_id uuid,p_preview_id uuid,p_openings jsonb)returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='30s' as $$
declare actor uuid:=private.require_personal_actor();request_hash text;old public.personal_fresh_start_operations%rowtype;
 preview public.personal_fresh_start_previews%rowtype;snapshot jsonb;old_period uuid;new_period uuid:=gen_random_uuid();instant timestamptz:=clock_timestamp();choice jsonb;unit public.personal_accounts%rowtype;parent public.personal_accounts%rowtype;ids uuid[];opening bigint;result_payload jsonb;anchor uuid;method text;
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
 -- iat changes on refresh; only a signed authentication-method timestamp proves recent sign-in.
 select x->>'method' into method from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'))x
 where x->>'method' in('password','oauth','otp','sso/saml')and x->>'timestamp'~'^[0-9]+$'
 and (x->>'timestamp')::numeric between extract(epoch from clock_timestamp())-300 and extract(epoch from clock_timestamp())+30 order by(x->>'timestamp')::numeric desc limit 1;
 if method is null then raise exception using message='fresh_start_reauthentication_required',errcode='P0001';end if;
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
 result_payload:=jsonb_build_object('schema_version',1,'owner_id',actor,'request_id',p_request_id,'period_id',new_period,'archived_period_id',old_period,'completed_at',instant,'authentication_method',method,'policy','carry_all');
 insert into public.personal_fresh_start_operations(owner_participant_id,request_id,status,payload_fingerprint,result)values(actor,p_request_id,'committed',request_hash,result_payload);
 return result_payload;
end $$;


create or replace function public.get_personal_ledger_period_state()returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();begin
 return jsonb_build_object('schema_version',1,'opening_safety_version',2,'owner_id',actor,
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

revoke all on function public.apply_personal_fresh_start(uuid,uuid,jsonb)from public,anon;
grant execute on function public.apply_personal_fresh_start(uuid,uuid,jsonb)to authenticated;
notify pgrst,'reload schema';
$tabby_personal_periods_ddl_1$;
  execute migration_sql;
  insert into supabase_migrations.schema_migrations(version,name,statements)values('202610250002','personal_period_opening_safety',array[migration_sql]);
 end if;

 if pg_catalog.to_regprocedure('public.get_personal_ledger_period_state()')is null
 or pg_catalog.to_regprocedure('public.apply_personal_fresh_start(uuid,uuid,jsonb)')is null
 or pg_catalog.to_regprocedure('public.reconcile_personal_fresh_start(uuid)')is null
 or pg_catalog.to_regprocedure('public.get_personal_ledger_archive(uuid)')is null
 or pg_catalog.to_regprocedure('private.personal_period_opening_locks(uuid)')is null
 or(select count(*)from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relname in('personal_ledger_periods','personal_period_expenses','personal_period_transactions','personal_period_openings','personal_fresh_start_previews','personal_fresh_start_operations')and c.relrowsecurity)<>6 then
  raise exception 'Personal period safeguards are incomplete.';end if;
end $tabby_personal_periods_apply$;
notify pgrst,'reload schema';
commit;
select 'TABBY_PERSONAL_PERIODS_INSTALL_COMPLETE_20261025_V2' as result;
-- END OF COMPLETE FILE — TABBY_PERSONAL_PERIODS_INSTALL_COMPLETE_20261025_V2
