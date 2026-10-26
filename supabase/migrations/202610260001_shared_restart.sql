-- A forward, explicit full-reset policy. Original purchases/payments remain immutable.
-- Only current shared obligations are cleared. Retag restores an unpaid original
-- obligation after the recipient accepts, without another purchase or cash entry.
begin;
create table public.shared_restart_completions(
 owner_id uuid not null references public.participants(id),
 request_id uuid not null,
 period_id uuid not null references public.personal_ledger_periods(id),
 primary key(owner_id,request_id),unique(period_id)
);
create table public.shared_restart_expenses(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 owner_id uuid not null references public.participants(id),
 period_id uuid not null references public.personal_ledger_periods(id),
 expense_id uuid not null references public.expenses(id),
 created_at timestamptz not null default clock_timestamp(),
 unique(owner_id,period_id,expense_id)
);
create table public.shared_restart_edges(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 marker_id uuid not null references public.shared_restart_expenses(id),
 expense_id uuid not null references public.expenses(id),
 debtor_id uuid not null references public.participants(id),
 creditor_id uuid not null references public.participants(id),
 remaining_minor bigint not null check(remaining_minor between 0 and 9007199254740991),
 created_at timestamptz not null default clock_timestamp(),
 check(debtor_id<>creditor_id),unique(marker_id,debtor_id,creditor_id)
);
create table public.shared_restart_allocations(
 owner_id uuid not null references public.participants(id),
 period_id uuid not null references public.personal_ledger_periods(id),
 allocation_id uuid not null references public.settlement_allocations(id),
 primary key(owner_id,period_id,allocation_id)
);
create table public.shared_restart_payment_requests(
 owner_id uuid not null references public.participants(id),
 period_id uuid not null references public.personal_ledger_periods(id),
 request_id uuid not null references public.settlement_payment_requests(id),
 primary key(owner_id,period_id,request_id)
);
create table public.shared_restart_retags(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 edge_id uuid not null references public.shared_restart_edges(id),
 expense_id uuid not null references public.expenses(id),
 requester_id uuid not null references public.participants(id),
 recipient_id uuid not null references public.participants(id),
 client_request_id uuid not null,
 expense_version integer not null,
 state text not null default 'pending' check(state in('pending','accepted','declined','superseded')),
 created_at timestamptz not null default clock_timestamp(),responded_at timestamptz,
 check(requester_id<>recipient_id),unique(requester_id,client_request_id)
);
create unique index one_live_shared_retag on public.shared_restart_retags(edge_id)where state in('pending','accepted');
create table public.shared_restart_dismissals(
 owner_id uuid not null references public.participants(id),
 expense_id uuid not null references public.expenses(id),
 primary key(owner_id,expense_id)
);
create index shared_restart_expense_lookup on public.shared_restart_expenses(expense_id);
create index shared_restart_retag_expense on public.shared_restart_retags(expense_id,expense_version);
create index shared_restart_expense_owner on public.shared_restart_expenses(owner_id,expense_id);
create index shared_restart_edge_pair on public.shared_restart_edges(expense_id,debtor_id,creditor_id,created_at desc);
create index shared_restart_allocation_lookup on public.shared_restart_allocations(allocation_id);

alter table public.shared_restart_completions enable row level security;
revoke all on public.shared_restart_completions from public,anon,authenticated;
grant select on public.shared_restart_completions to authenticated;
create policy read_shared_restart on public.shared_restart_completions for select to authenticated using(owner_id=public.current_participant_id());

alter table public.shared_restart_expenses enable row level security;
revoke all on public.shared_restart_expenses from public,anon,authenticated;
grant select on public.shared_restart_expenses to authenticated;
create policy read_shared_restart on public.shared_restart_expenses for select to authenticated using(private.can_read_expense(expense_id,public.current_participant_id()));

alter table public.shared_restart_edges enable row level security;
revoke all on public.shared_restart_edges from public,anon,authenticated;
grant select on public.shared_restart_edges to authenticated;
create policy read_shared_restart on public.shared_restart_edges for select to authenticated using(private.can_read_expense(expense_id,public.current_participant_id()));

alter table public.shared_restart_retags enable row level security;
revoke all on public.shared_restart_retags from public,anon,authenticated;
grant select on public.shared_restart_retags to authenticated;
create policy read_shared_restart on public.shared_restart_retags for select to authenticated using(private.can_read_expense(expense_id,public.current_participant_id()));

alter table public.shared_restart_allocations enable row level security;
revoke all on public.shared_restart_allocations from public,anon,authenticated;
grant select on public.shared_restart_allocations to authenticated;
create policy read_shared_restart on public.shared_restart_allocations for select to authenticated using(exists(select 1 from public.settlement_allocations a where a.id=allocation_id));

alter table public.shared_restart_payment_requests enable row level security;
revoke all on public.shared_restart_payment_requests from public,anon,authenticated;
grant select on public.shared_restart_payment_requests to authenticated;
create policy read_shared_restart on public.shared_restart_payment_requests for select to authenticated using(owner_id=public.current_participant_id());

alter table public.shared_restart_dismissals enable row level security;
revoke all on public.shared_restart_dismissals from public,anon,authenticated;
grant select on public.shared_restart_dismissals to authenticated;
create policy read_shared_restart on public.shared_restart_dismissals for select to authenticated using(owner_id=public.current_participant_id());

create function private.shared_restart_family(target uuid)returns setof uuid language sql stable security definer set search_path='' as $$
 with recursive ancestors as(select id,corrects_expense_id from public.expenses where id=target
 union select e.id,e.corrects_expense_id from public.expenses e join ancestors a on e.id=a.corrects_expense_id)
 select id from ancestors;
$$;
create function private.latest_shared_restart_edge(target uuid,debtor uuid,creditor uuid)returns uuid language sql stable security definer set search_path='' as $$
 select r.id from public.shared_restart_edges r where r.expense_id in(select private.shared_restart_family(target))
 and r.debtor_id=debtor and r.creditor_id=creditor order by r.created_at desc,r.id desc limit 1;
$$;
create function private.shared_restart_amount(target uuid,debtor uuid,creditor uuid,original_minor bigint)returns bigint language plpgsql stable security definer set search_path='' as $$
 declare edge uuid;remaining bigint;begin
 edge:=private.latest_shared_restart_edge(target,debtor,creditor);
 if edge is null then
 if exists(select 1 from public.shared_restart_expenses m where m.expense_id in(select private.shared_restart_family(target))and m.owner_id in(debtor,creditor))then return 0;end if;return original_minor;end if;
 select r.remaining_minor into remaining from public.shared_restart_edges r
 where r.id=edge and exists(select 1 from public.shared_restart_retags t join public.expenses e on e.id=t.expense_id
 where t.edge_id=r.id and t.state='accepted' and t.expense_id=target and e.status='active');
 return least(original_minor,coalesce(remaining,0));
 end $$;
create function private.shared_allocation_cleared(target uuid)returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.shared_restart_allocations where allocation_id=target);
$$;

create or replace function private.shared_raw_expense_obligation(
  target_expense_id uuid,
  target_debtor_id uuid,
  target_creditor_id uuid
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with positions as (
    select participation.expense_id,
      participation.participant_id,
      participation.participant_order,
      coalesce(contribution.amount_minor, 0) - share.amount_minor as net_minor
    from public.expense_participations as participation
    left join public.payer_contributions as contribution
      on contribution.expense_participation_id = participation.id
    join public.expense_shares as share
      on share.expense_participation_id = participation.id
    join public.expenses as expense on expense.id = participation.expense_id
    where participation.expense_id = target_expense_id
      and (expense.scope='space' or (participation.state='accepted' and participation.tracking_mode='tracked'))
      and expense.status = 'active'
      and expense.scope in('direct','space')
  ), debtors as (
    select *, -net_minor as amount_minor,
      coalesce(pg_catalog.sum(-net_minor) over (
        partition by expense_id order by participant_order, participant_id
        rows between unbounded preceding and 1 preceding
      ), 0) as start_minor,
      pg_catalog.sum(-net_minor) over (
        partition by expense_id order by participant_order, participant_id
        rows between unbounded preceding and current row
      ) as end_minor
    from positions where net_minor < 0
  ), creditors as (
    select *, net_minor as amount_minor,
      coalesce(pg_catalog.sum(net_minor) over (
        partition by expense_id order by participant_order, participant_id
        rows between unbounded preceding and 1 preceding
      ), 0) as start_minor,
      pg_catalog.sum(net_minor) over (
        partition by expense_id order by participant_order, participant_id
        rows between unbounded preceding and current row
      ) as end_minor
    from positions where net_minor > 0
  )
  select coalesce(pg_catalog.sum(
    greatest(0, least(debtor.end_minor, creditor.end_minor)
      - greatest(debtor.start_minor, creditor.start_minor))
  ), 0)::bigint
  from debtors as debtor
  join creditors as creditor on creditor.expense_id = debtor.expense_id
  where debtor.participant_id = target_debtor_id
    and creditor.participant_id = target_creditor_id;
$$;

create or replace function private.direct_expense_obligation(target_expense_id uuid,target_debtor_id uuid,target_creditor_id uuid)returns bigint language sql stable security definer set search_path='' as $$
 select coalesce((select private.shared_restart_amount(target_expense_id,target_debtor_id,target_creditor_id,
 private.shared_raw_expense_obligation(target_expense_id,target_debtor_id,target_creditor_id))
 where exists(select 1 from public.expenses where id=target_expense_id and scope='direct')),0);
$$;

create or replace function private.direct_signed_outstanding(
  first_participant_id uuid,
  second_participant_id uuid,
  currency_code text
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  with relevant_expenses as (
    select expense.id
    from public.expenses as expense
    where expense.scope = 'direct'
      and expense.status = 'active'
      and expense.currency = pg_catalog.upper(currency_code)
      and exists (
        select 1 from public.expense_participations
        where expense_id = expense.id
          and participant_id = first_participant_id
          and state = 'accepted' and tracking_mode = 'tracked'
      )
      and exists (
        select 1 from public.expense_participations
        where expense_id = expense.id
          and participant_id = second_participant_id
          and state = 'accepted' and tracking_mode = 'tracked'
      )
  ), expense_effect as (
    select coalesce(pg_catalog.sum(
      private.direct_expense_obligation(
        expense.id, first_participant_id, second_participant_id
      ) - private.direct_expense_obligation(
        expense.id, second_participant_id, first_participant_id
      )
    ), 0)::bigint as amount_minor
    from relevant_expenses as expense
  ), transfer_effect as (
    select coalesce(pg_catalog.sum(
      case
        when payment.debtor_participant_id = first_participant_id
          and allocation.creditor_participant_id = second_participant_id
          then -(case when allocation.state = 'reversed' then 0
            else allocation.amount_minor - coalesce(reversal.amount_minor, 0) end)
        when payment.debtor_participant_id = second_participant_id
          and allocation.creditor_participant_id = first_participant_id
          then (case when allocation.state = 'reversed' then 0
            else allocation.amount_minor - coalesce(reversal.amount_minor, 0) end)
        else 0
      end
    ), 0)::bigint as amount_minor
    from public.settlement_payments as payment
    join public.settlement_allocations as allocation
      on allocation.settlement_payment_id = payment.id
    left join public.settlement_allocation_reversals as reversal
      on reversal.settlement_allocation_id = allocation.id
    where payment.scope = 'direct'
      and payment.currency = pg_catalog.upper(currency_code)
      and allocation.state in ('accepted', 'reversed')
      and not private.shared_allocation_cleared(allocation.id)
      and (
        payment.debtor_participant_id = first_participant_id
          and allocation.creditor_participant_id = second_participant_id
        or payment.debtor_participant_id = second_participant_id
          and allocation.creditor_participant_id = first_participant_id
      )
  )
  select expense_effect.amount_minor + transfer_effect.amount_minor
  from expense_effect cross join transfer_effect;
$$;

create or replace function private.space_signed_outstanding(
  target_space_id uuid, first_participant_id uuid,
  second_participant_id uuid, currency_code text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare result_minor numeric;
begin
  with positions as (
    select participation.expense_id, participation.participant_id,
      participation.participant_order,
      coalesce(contribution.amount_minor, 0) - share.amount_minor as net_minor
    from public.expenses as expense
    join public.expense_participations as participation on participation.expense_id = expense.id
    join public.expense_shares as share on share.expense_participation_id = participation.id
    left join public.payer_contributions as contribution on contribution.expense_participation_id = participation.id
    where expense.scope = 'space' and expense.space_id = target_space_id
      and expense.status = 'active' and expense.currency = pg_catalog.upper(currency_code)
    -- Space pairing includes all participations, unlike Direct accepted/tracked.
  ), debtors as (
    select *, coalesce(pg_catalog.sum(-net_minor) over (
      partition by expense_id order by participant_order, participant_id
      rows between unbounded preceding and 1 preceding
    ), 0) as start_minor, pg_catalog.sum(-net_minor) over (
      partition by expense_id order by participant_order, participant_id
      rows between unbounded preceding and current row
    ) as end_minor from positions where net_minor < 0
  ), creditors as (
    select *, coalesce(pg_catalog.sum(net_minor) over (
      partition by expense_id order by participant_order, participant_id
      rows between unbounded preceding and 1 preceding
    ), 0) as start_minor, pg_catalog.sum(net_minor) over (
      partition by expense_id order by participant_order, participant_id
      rows between unbounded preceding and current row
    ) as end_minor from positions where net_minor > 0
  ), expense_effect as (
    select coalesce(pg_catalog.sum(
      (case when debtor.participant_id = first_participant_id then 1 else -1 end)
      * private.shared_restart_amount(debtor.expense_id,debtor.participant_id,creditor.participant_id,
        greatest(0,least(debtor.end_minor,creditor.end_minor)-greatest(debtor.start_minor,creditor.start_minor))::bigint)
    ), 0) as amount_minor
    from debtors as debtor join creditors as creditor using (expense_id)
    where (debtor.participant_id = first_participant_id and creditor.participant_id = second_participant_id)
       or (debtor.participant_id = second_participant_id and creditor.participant_id = first_participant_id)
  ), reversals as (
    select settlement_allocation_id, pg_catalog.sum(amount_minor) as amount_minor
    from public.settlement_allocation_reversals group by settlement_allocation_id
  ), transfer_effect as (
    select coalesce(pg_catalog.sum(
      (case when payment.debtor_participant_id = first_participant_id then -1 else 1 end)
      * (case when allocation.state = 'reversed' then 0
         else allocation.amount_minor - coalesce(reversal.amount_minor, 0) end)
    ), 0) as amount_minor
    from public.settlement_payments as payment
    join public.settlement_allocations as allocation on allocation.settlement_payment_id = payment.id
    left join reversals as reversal on reversal.settlement_allocation_id = allocation.id
    where payment.scope = 'space' and payment.space_id = target_space_id
      and payment.currency = pg_catalog.upper(currency_code)
      and allocation.state in ('accepted', 'reversed')
      and not private.shared_allocation_cleared(allocation.id)
      and ((payment.debtor_participant_id = first_participant_id and allocation.creditor_participant_id = second_participant_id)
        or (payment.debtor_participant_id = second_participant_id and allocation.creditor_participant_id = first_participant_id))
  )
  select expense_effect.amount_minor + transfer_effect.amount_minor into result_minor
  from expense_effect cross join transfer_effect;
  if pg_catalog.abs(result_minor) > 9007199254740991 then
    raise exception using message = 'amount_overflow', errcode = 'P0001';
  end if;
  return result_minor::bigint;
end;
$$;

create function private.shared_restart_remaining_edges(actor uuid)
 returns table(expense_id uuid,debtor_id uuid,creditor_id uuid,remaining_minor bigint)
 language sql stable security definer set search_path='' as $$
 with raw as(
 select e.id,e.scope,e.space_id,e.currency,e.occurred_on,e.created_at,d.participant_id debtor,c.participant_id creditor,
 private.shared_raw_expense_obligation(e.id,d.participant_id,c.participant_id) original_minor
 from public.expenses e join public.expense_participations d on d.expense_id=e.id
 join public.expense_participations c on c.expense_id=e.id and c.participant_id<>d.participant_id
 where e.status='active' and e.scope in('direct','space')
 ), amounts as(
 select *,private.shared_restart_amount(id,debtor,creditor,original_minor) effective_minor,
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
 case when r.prior_edge is not null and r.effective_minor=0 then least(r.original_minor,(select x.remaining_minor from public.shared_restart_edges x where x.id=r.prior_edge))
 else greatest(0,r.effective_minor-greatest(0,coalesce(t.net_minor,0)-r.prior_minor))::bigint end
 from ranked r left join transfers t on t.scope=r.scope and t.space_id is not distinct from r.space_id
 and t.currency=r.currency and t.debtor=r.debtor and t.creditor=r.creditor
 where actor in(r.debtor,r.creditor);
$$;

alter function private.personal_period_snapshot(uuid)rename to personal_period_snapshot_before_shared_restart;
create function private.personal_period_snapshot(actor uuid)returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare s jsonb;graph jsonb;begin
 s:=private.personal_period_snapshot_before_shared_restart(actor);
 select coalesce(jsonb_agg(to_jsonb(x)order by x.id),'[]')into graph from(
 select r.id,r.state,r.responded_at from public.shared_restart_retags r
 where r.requester_id=actor or r.recipient_id=actor
 union all select m.id,'reset',m.created_at from public.shared_restart_expenses m
 where private.can_read_expense(m.expense_id,actor))x;
 return s||jsonb_build_object('shared_restart_version',1,'fingerprint',private.personal_payload_fingerprint(jsonb_build_object('prior',s->>'fingerprint','shared',graph)));
 end $$;
create function public.apply_personal_fresh_start_v2(p_request_id uuid,p_preview_id uuid,p_openings jsonb)returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' set statement_timeout='30s' as $$
 declare actor uuid:=private.require_personal_actor();receipt_payload jsonb;period uuid;begin
 perform pg_advisory_xact_lock(hashtextextended('fresh-start:'||actor::text,0));
 if exists(select 1 from public.personal_fresh_start_operations where owner_participant_id=actor and request_id=p_request_id and status='committed')
 and not exists(select 1 from public.shared_restart_completions where owner_id=actor and request_id=p_request_id)then raise exception 'idempotency_conflict';end if;
 receipt_payload:=public.apply_personal_fresh_start(p_request_id,p_preview_id,p_openings);
 lock table public.shared_restart_completions,public.shared_restart_expenses,public.shared_restart_edges,public.shared_restart_allocations,public.shared_restart_payment_requests,public.shared_restart_retags,public.shared_restart_dismissals in exclusive mode;
 period:=(receipt_payload->>'period_id')::uuid;
 if exists(select 1 from public.shared_restart_completions where owner_id=actor and request_id=p_request_id)then return receipt_payload||jsonb_build_object('shared_restart_version',1);end if;
 insert into public.shared_restart_completions(owner_id,request_id,period_id)values(actor,p_request_id,period);
 -- Every accessible old shared record is owner-archived, including unaccepted invitations.
 insert into public.shared_restart_expenses(owner_id,period_id,expense_id)
 select actor,period,e.id from public.expenses e where e.scope in('direct','space')
 and(e.created_by=actor or exists(select 1 from public.expense_participations p where p.expense_id=e.id and p.participant_id=actor));
 insert into public.shared_restart_edges(marker_id,expense_id,debtor_id,creditor_id,remaining_minor)
 select m.id,r.expense_id,r.debtor_id,r.creditor_id,r.remaining_minor
 from private.shared_restart_remaining_edges(actor)r join public.shared_restart_expenses m on m.expense_id=r.expense_id and m.owner_id=actor and m.period_id=period;
 insert into public.shared_restart_allocations(owner_id,period_id,allocation_id)
 select actor,period,a.id from public.settlement_allocations a join public.settlement_payments p on p.id=a.settlement_payment_id
 where actor in(p.debtor_participant_id,a.creditor_participant_id);
 insert into public.shared_restart_payment_requests(owner_id,period_id,request_id)
 select actor,period,id from public.settlement_payment_requests where actor in(debtor_participant_id,creditor_participant_id);
 receipt_payload:=receipt_payload||jsonb_build_object('shared_restart_version',1);
 update public.personal_fresh_start_operations set result=receipt_payload where owner_participant_id=actor and request_id=p_request_id;
 return receipt_payload;
 end $$;

create or replace function public.get_personal_ledger_period_state()returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=private.require_personal_actor();begin
 return jsonb_build_object('schema_version',1,'opening_safety_version',2,'fresh_start_confirmation_version',1,'shared_restart_version',1,'owner_id',actor,
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

create function public.request_shared_split_retag(request_id uuid,target_edge_id uuid,target_expense_id uuid,expected_expense_version integer)returns uuid language plpgsql security definer set search_path='' as $$
 declare actor uuid:=private.require_personal_actor();edge public.shared_restart_edges%rowtype;marker public.shared_restart_expenses%rowtype;expense public.expenses%rowtype;saved public.shared_restart_retags%rowtype;begin
 perform private.lock_collect_pay_balance();
 lock table public.shared_restart_completions,public.shared_restart_expenses,public.shared_restart_edges,public.shared_restart_allocations,public.shared_restart_payment_requests,public.shared_restart_retags,public.shared_restart_dismissals in exclusive mode;
 select * into saved from public.shared_restart_retags where requester_id=actor and client_request_id=request_id;
 if found then if saved.edge_id<>target_edge_id or saved.expense_id<>target_expense_id or saved.expense_version<>expected_expense_version then raise exception 'idempotency_conflict';end if;return saved.id;end if;
 select * into edge from public.shared_restart_edges where id=target_edge_id;
 select * into marker from public.shared_restart_expenses where id=edge.marker_id;
 select * into expense from public.expenses where id=target_expense_id;
 if edge.id is null or request_id is null or actor=marker.owner_id or actor not in(edge.debtor_id,edge.creditor_id)
 or not private.can_read_expense(expense.id,actor)or expense.status<>'active' or expense.version<>expected_expense_version
 or edge.id is distinct from private.latest_shared_restart_edge(expense.id,edge.debtor_id,edge.creditor_id)or edge.remaining_minor<=0
 then raise exception 'shared_retag_unavailable';end if;
 update public.shared_restart_retags set state='superseded',responded_at=clock_timestamp()where edge_id=edge.id and state='pending'and expense_version<>expense.version;
 insert into public.shared_restart_retags(edge_id,expense_id,requester_id,recipient_id,client_request_id,expense_version)
 values(edge.id,expense.id,actor,marker.owner_id,request_id,expense.version)returning * into saved;
 return saved.id;end $$;
create function public.respond_shared_split_retag(target_request_id uuid,response text,expected_expense_version integer)returns text language plpgsql security definer set search_path='' as $$
 declare actor uuid:=private.require_personal_actor();r public.shared_restart_retags%rowtype;e public.shared_restart_edges%rowtype;begin
 if response not in('accepted','declined')then raise exception 'invalid_response';end if;
 perform private.lock_collect_pay_balance();
 lock table public.shared_restart_completions,public.shared_restart_expenses,public.shared_restart_edges,public.shared_restart_allocations,public.shared_restart_payment_requests,public.shared_restart_retags,public.shared_restart_dismissals in exclusive mode;
 select * into r from public.shared_restart_retags where id=target_request_id for update;
 select * into e from public.shared_restart_edges where id=r.edge_id;
 if r.id is null or r.recipient_id<>actor or not private.can_read_expense(r.expense_id,actor)
 or r.expense_version<>expected_expense_version
 or not exists(select 1 from public.expenses x where x.id=r.expense_id and x.status='active' and x.version=r.expense_version)
 or e.id is distinct from private.latest_shared_restart_edge(r.expense_id,e.debtor_id,e.creditor_id)then raise exception 'shared_retag_unavailable';end if;
 if r.state<>'pending'then if r.state<>response then raise exception 'idempotency_conflict';end if;return r.state;end if;
 update public.shared_restart_retags set state=response,responded_at=clock_timestamp()where id=r.id;
 if response='accepted'then delete from public.shared_restart_dismissals where owner_id=actor and expense_id=r.expense_id;end if;
 return response;end $$;
create function public.dismiss_shared_restart_bill(target_expense_id uuid)returns void language plpgsql security definer set search_path='' as $$
 declare actor uuid:=private.require_personal_actor();begin
 perform private.lock_collect_pay_balance();
 if not private.can_read_expense(target_expense_id,actor)or not exists(select 1 from public.shared_restart_expenses where expense_id=target_expense_id)
 or exists(select 1 from public.expense_participations d join public.expense_participations c on c.expense_id=d.expense_id
 where d.expense_id=target_expense_id and actor in(d.participant_id,c.participant_id)and d.participant_id<>c.participant_id
 and private.shared_restart_amount(target_expense_id,d.participant_id,c.participant_id,private.shared_raw_expense_obligation(target_expense_id,d.participant_id,c.participant_id))>0)
 then raise exception 'shared_bill_still_active';end if;
 insert into public.shared_restart_dismissals values(actor,target_expense_id)on conflict do nothing;
 end $$;
-- Old pending confirmations may not resurrect obligations or post a cash leg after Reset.
create function private.guard_restarted_shared_task()returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if tg_table_name='settlement_allocations'and new.state='accepted'and old.state<>'accepted'and private.shared_allocation_cleared(new.id)then raise exception 'shared_split_cleared';end if;
 return new;end $$;
create trigger guard_restarted_shared_task before update on public.settlement_allocations for each row execute function private.guard_restarted_shared_task();

create function public.shared_restart_state(source_row public.expenses)returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare actor uuid:=public.current_participant_id();families uuid[];owners jsonb;edges jsonb;retags jsonb;hidden boolean;canonical public.expenses%rowtype;begin
 select * into canonical from public.expenses where id=source_row.id;
 if not found then return null;end if;
 if actor is null or not private.can_read_expense(canonical.id,actor)then return null;end if;
 select array_agg(x)into families from private.shared_restart_family(canonical.id)x;
 if not exists(select 1 from public.shared_restart_expenses where expense_id=any(families))then return null;end if;
 select coalesce(jsonb_agg(distinct owner_id),'[]')into owners from public.shared_restart_expenses where expense_id=any(families);
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'debtor_id',e.debtor_id,'creditor_id',e.creditor_id,'recipient_id',m.owner_id,'remaining_minor',e.remaining_minor::text,
 'effective_minor',private.shared_restart_amount(canonical.id,e.debtor_id,e.creditor_id,private.shared_raw_expense_obligation(canonical.id,e.debtor_id,e.creditor_id))::text)order by e.id),'[]')into edges
 from public.shared_restart_edges e join public.shared_restart_expenses m on m.id=e.marker_id
 where e.expense_id=any(families)and e.id=private.latest_shared_restart_edge(canonical.id,e.debtor_id,e.creditor_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'edge_id',r.edge_id,'requester_id',r.requester_id,'recipient_id',r.recipient_id,'state',r.state,'expense_version',r.expense_version,'created_at',r.created_at)order by r.created_at,r.id),'[]')into retags
 from public.shared_restart_retags r join public.shared_restart_edges e on e.id=r.edge_id
 where r.expense_id=canonical.id and (r.state='accepted'or r.expense_version=canonical.version) and e.id=private.latest_shared_restart_edge(canonical.id,e.debtor_id,e.creditor_id);
 hidden:=exists(select 1 from public.shared_restart_dismissals where owner_id=actor and expense_id=canonical.id)
 or(exists(select 1 from public.shared_restart_expenses where owner_id=actor and expense_id=any(families))
 and not exists(select 1 from public.shared_restart_retags r join public.shared_restart_edges e on e.id=r.edge_id
 where r.expense_id=canonical.id and r.state='accepted'and r.recipient_id=actor and (r.state='accepted'or r.expense_version=canonical.version) and e.id=private.latest_shared_restart_edge(canonical.id,e.debtor_id,e.creditor_id)));
 return jsonb_build_object('owner_ids',owners,'hidden_for_viewer',hidden,'edges',edges,'retags',retags);
 end $$;
create function public.shared_restart_cleared(source_row public.settlement_allocations)returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select private.can_read_settlement(a.settlement_payment_id,public.current_participant_id())and private.shared_allocation_cleared(a.id)from public.settlement_allocations a where a.id=source_row.id),false);
$$;

create function public.shared_restart_cleared(source_row public.settlement_payment_requests)returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.settlement_payment_requests r where r.id=source_row.id and public.current_participant_id()in(r.debtor_participant_id,r.creditor_participant_id)and exists(select 1 from public.shared_restart_payment_requests m where m.request_id=r.id));
$$;

revoke all on function private.shared_restart_family(uuid)from public,anon,authenticated;

revoke all on function private.latest_shared_restart_edge(uuid,uuid,uuid)from public,anon,authenticated;

revoke all on function private.shared_restart_amount(uuid,uuid,uuid,bigint)from public,anon,authenticated;

revoke all on function private.shared_allocation_cleared(uuid)from public,anon,authenticated;

revoke all on function private.shared_raw_expense_obligation(uuid,uuid,uuid)from public,anon,authenticated;

revoke all on function private.shared_restart_remaining_edges(uuid)from public,anon,authenticated;

revoke all on function private.personal_period_snapshot_before_shared_restart(uuid)from public,anon,authenticated;

revoke all on function private.personal_period_snapshot(uuid)from public,anon,authenticated;

revoke all on function private.guard_restarted_shared_task()from public,anon,authenticated;

revoke all on function public.apply_personal_fresh_start_v2(uuid,uuid,jsonb)from public,anon;
grant execute on function public.apply_personal_fresh_start_v2(uuid,uuid,jsonb)to authenticated;

revoke all on function public.request_shared_split_retag(uuid,uuid,uuid,integer)from public,anon;
grant execute on function public.request_shared_split_retag(uuid,uuid,uuid,integer)to authenticated;

revoke all on function public.respond_shared_split_retag(uuid,text,integer)from public,anon;
grant execute on function public.respond_shared_split_retag(uuid,text,integer)to authenticated;

revoke all on function public.dismiss_shared_restart_bill(uuid)from public,anon;
grant execute on function public.dismiss_shared_restart_bill(uuid)to authenticated;

revoke all on function public.get_personal_ledger_period_state()from public,anon;
grant execute on function public.get_personal_ledger_period_state()to authenticated;

revoke all on function public.shared_restart_state(public.expenses)from public,anon;
grant execute on function public.shared_restart_state(public.expenses)to authenticated;

revoke all on function public.shared_restart_cleared(public.settlement_allocations)from public,anon;
grant execute on function public.shared_restart_cleared(public.settlement_allocations)to authenticated;

revoke all on function public.shared_restart_cleared(public.settlement_payment_requests)from public,anon;
grant execute on function public.shared_restart_cleared(public.settlement_payment_requests)to authenticated;

do $$declare t text;begin
 foreach t in array array['shared_restart_expenses','shared_restart_retags','shared_restart_allocations']loop
 if exists(select 1 from pg_publication where pubname='supabase_realtime')and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'and schemaname='public'and tablename=t)then
 execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;end $$;
notify pgrst,'reload schema';
commit;
