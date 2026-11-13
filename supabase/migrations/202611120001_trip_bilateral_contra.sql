-- Forward Trip contra read model and explicit-net native coverage. No history rewrite.
begin;


-- Same canonical native query; leave the legacy function and its volatility untouched.
CREATE OR REPLACE FUNCTION private.contra_signed_outstanding(target_space_id uuid, first_participant_id uuid, second_participant_id uuid, currency_code text)
 RETURNS bigint
 LANGUAGE plpgsql STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $$
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
      and payment.currency = pg_catalog.upper(currency_code) and payment.fx_cash_only = false
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


-- Auditable original directions; read only, excluded from all cash calculations.
create function private.contra_native_audit(trip uuid,a uuid,b uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 with codes as(select distinct currency from public.expenses where scope='space'and space_id=trip and status='active'),bills as(
 select c.currency,coalesce(sum(private.shared_restart_amount(e.id,a,b,private.shared_raw_expense_obligation(e.id,a,b))),0)::bigint forward,coalesce(sum(private.shared_restart_amount(e.id,b,a,private.shared_raw_expense_obligation(e.id,b,a))),0)::bigint reverse from codes c join public.expenses e on e.scope='space'and e.space_id=trip and e.status='active'and e.currency=c.currency group by c.currency
 ),reversals as(select settlement_allocation_id,sum(amount_minor)::bigint minor from public.settlement_allocation_reversals group by settlement_allocation_id),paid as(
 select p.currency,coalesce(sum(case when p.debtor_participant_id=a then case when l.state='reversed'then 0 else l.amount_minor-coalesce(r.minor,0)end else 0 end),0)::bigint forward,coalesce(sum(case when p.debtor_participant_id=b then case when l.state='reversed'then 0 else l.amount_minor-coalesce(r.minor,0)end else 0 end),0)::bigint reverse from public.settlement_payments p join public.settlement_allocations l on l.settlement_payment_id=p.id left join reversals r on r.settlement_allocation_id=l.id where p.scope='space'and p.space_id=trip and not p.fx_cash_only and l.state in('accepted','reversed')and not private.shared_allocation_cleared(l.id)and((p.debtor_participant_id=a and l.creditor_participant_id=b)or(p.debtor_participant_id=b and l.creditor_participant_id=a))group by p.currency
 )select coalesce(jsonb_agg(jsonb_build_object('currency',c.currency,'aBills',coalesce(bi.forward,0),'bBills',coalesce(bi.reverse,0),'aApplied',coalesce(p.forward,0),'bApplied',coalesce(p.reverse,0))order by c.currency),'[]')from codes c left join bills bi using(currency)left join paid p using(currency)
$$;


-- A read model over existing original-currency facts, never a second ledger.
create function private.contra_quote(mode text,custom_rate text,display_currency text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare snapshot uuid;rates jsonb;n numeric;d numeric;
begin
 if mode is null or mode not in('system','custom')or private.currency_digits(display_currency)is null then raise exception using message='invalid_rate',errcode='P0001';end if;
 select s.id,s.rates into snapshot,rates from tabby_fx.refresh_state r join tabby_fx.snapshots s on s.id=r.snapshot_id where r.singleton;
 if mode='custom'then
  if coalesce(custom_rate,'')!~'^[0-9]{1,12}(\.[0-9]{1,12})?$'or custom_rate::numeric<=0 then raise exception using message='invalid_rate',errcode='P0001';end if;
  n:=custom_rate::numeric;d:=1;
 else n:=(rates->'VND'->>'denominator')::numeric;d:=(rates->'VND'->>'numerator')::numeric;end if;
 return jsonb_build_object('mode',mode,'snapshotId',snapshot,'rates',coalesce(rates,'{}'::jsonb),'numerator',n::text,'denominator',d::text,'displayCurrency',upper(display_currency));
end$$;
create function private.contra_display_value(amount bigint,code text,quote jsonb)
returns bigint language plpgsql immutable set search_path='' as $$
#variable_conflict use_variable
declare target text:=quote->>'displayCurrency';cn numeric;cd numeric;tn numeric;td numeric;
begin
 if amount<0 or amount>9007199254740991 then raise exception using message='invalid_amount',errcode='P0001';end if;
 if code=target then return amount;end if;
 cn:=case code when'MYR'then 1 when'VND'then(quote->>'numerator')::numeric else(quote->'rates'->code->>'denominator')::numeric end;
 cd:=case code when'MYR'then 1 when'VND'then(quote->>'denominator')::numeric else(quote->'rates'->code->>'numerator')::numeric end;
 tn:=case target when'MYR'then 1 when'VND'then(quote->>'numerator')::numeric else(quote->'rates'->target->>'denominator')::numeric end;
 td:=case target when'MYR'then 1 when'VND'then(quote->>'denominator')::numeric else(quote->'rates'->target->>'numerator')::numeric end;
 if cn is null or cd is null or tn is null or td is null or least(cn,cd,tn,td)<=0 then return null;end if;
 return private.fx_round_div(amount::numeric*(10::numeric^private.currency_digits(target))*cd*tn,(10::numeric^private.currency_digits(code))*cn*td);
end$$;
create function private.contra_native_pair(native jsonb,a uuid,b uuid,quote jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
#variable_conflict use_variable
declare leg jsonb;x bigint;f bigint:='0'::bigint;r bigint:='0'::bigint;known boolean:=true;estimated boolean:=false;
begin
 for leg in select q from jsonb_array_elements(native)q loop
  x:=private.contra_display_value((leg->>'minor')::bigint,leg->>'currency',quote);
  if x is null then known:=false;else if leg->>'from'=a::text then f:=f+x;else r:=r+x;end if;end if;
  estimated:=estimated or leg->>'currency'<>quote->>'displayCurrency';
 end loop;
 if greatest(f,r)>9007199254740991 then raise exception using message='invalid_amount',errcode='P0001';end if;
 return jsonb_build_object('known',known,'currency',quote->>'displayCurrency','estimated',estimated,'aOwesB',case when known then f end,'bOwesA',case when known then r end,'contraMinor',case when known then least(f,r)end,'netMinor',case when known then abs(f-r)end,'payer',case when known and f<>r then case when f>r then a else b end end,'recipient',case when known and f<>r then case when f>r then b else a end end);
end$$;
create function private.contra_pair(trip uuid,a uuid,b uuid,quote jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare native jsonb:='[]'::jsonb;available jsonb:='[]'::jsonb;code text;signed bigint;hold bigint;ready boolean:=true;held boolean:=false;leg jsonb;ledger jsonb;available_ledger jsonb;audit jsonb;display jsonb;gross_display jsonb;
begin
 for code in select distinct e.currency from public.expenses e where e.space_id=trip and e.scope='space'and e.status='active'order by e.currency loop
  signed:=private.contra_signed_outstanding(trip,a,b,code);
  if signed<>0 then
   leg:=jsonb_build_object('from',case when signed>0 then a else b end,'to',case when signed>0 then b else a end,'currency',code,'minor',abs(signed));native:=native||jsonb_build_array(leg);
   hold:=private.pending_pair_minor(trip,(leg->>'from')::uuid,(leg->>'to')::uuid,code);held:=held or hold>0;
   available:=available||jsonb_build_array(leg||jsonb_build_object('minor',greatest(abs(signed)-hold,0)));

  end if;
 end loop;
 -- A pending reservation never invents a reverse obligation or changes standing.
 ready:=exists(select 1 from public.space_members m where m.space_id=trip and m.participant_id=a and m.removed_at is null)and exists(select 1 from public.space_members m where m.space_id=trip and m.participant_id=b and m.removed_at is null);
 audit:=private.contra_native_audit(trip,a,b);display:=private.contra_native_pair(native,a,b,quote);gross_display:=private.contra_gross_display(audit,a,b,quote);
 if not coalesce((display->>'known')::boolean and(gross_display->>'known')::boolean and display->'netMinor'=gross_display->'netMinor'and display->'payer'=gross_display->'payer',false)then gross_display:=null;end if;
 ledger:=private.contra_native_pair(native,a,b,quote||jsonb_build_object('displayCurrency','VND'));available_ledger:=private.contra_native_pair(available,a,b,quote||jsonb_build_object('displayCurrency','VND'));
 return jsonb_build_object('id',a::text||':'||b::text,'a',a,'b',b,'edgeBasis','net','nativeBasis','same_currency_net','native',native,'availableNative',available,'display',display,'grossDisplay',gross_display,'ledgerCurrency','VND','ledger',ledger,'netMinor',ledger->'netMinor','payer',ledger->'payer','recipient',ledger->'recipient','availableMinor',case when ready and not held and(ledger->>'known')::boolean and(available_ledger->>'known')::boolean and ledger->>'payer'=available_ledger->>'payer'then least((ledger->>'netMinor')::bigint,(available_ledger->>'netMinor')::bigint)else 0 end,'pending',held,'currentMembers',ready,'audit',audit,'sourceVersions',private.fx_pair_expense_versions(trip,a,b));
end$$;
create function private.contra_matrix(trip uuid,quote jsonb)
returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare pairs jsonb:='[]'::jsonb;pair jsonb;row record;revision text;facts jsonb;
begin
 for row in select a.participant_id a,b.participant_id b from public.space_members a join public.space_members b on b.space_id=a.space_id and a.participant_id<b.participant_id where a.space_id=trip order by a.participant_id,b.participant_id loop
  pair:=private.contra_pair(trip,row.a,row.b,quote);if jsonb_array_length(pair->'native')>0 then pairs:=pairs||jsonb_build_array(pair);end if;
 end loop;
 -- Freeze all shared financial versions, not timestamps or private accounts.
 select jsonb_build_object('expenses',(select coalesce(jsonb_agg(jsonb_build_array(e.id,e.version,e.status)order by e.id),'[]')from public.expenses e where e.scope='space'and e.space_id=trip),'payments',(select coalesce(jsonb_agg(jsonb_build_array(p.id,p.version,p.status,p.currency,p.amount_minor)order by p.id),'[]')from public.settlement_payments p where p.scope='space'and p.space_id=trip),'allocations',(select coalesce(jsonb_agg(jsonb_build_array(a.id,a.state,a.amount_minor,a.creditor_participant_id)order by a.id),'[]')from public.settlement_allocations a join public.settlement_payments p on p.id=a.settlement_payment_id where p.scope='space'and p.space_id=trip),'members',(select coalesce(jsonb_agg(jsonb_build_array(m.participant_id,m.role,m.removed_at)order by m.participant_id),'[]')from public.space_members m where m.space_id=trip))into facts;
 revision:=encode(extensions.digest(jsonb_build_object('trip',trip,'quote',quote,'pairs',pairs,'facts',facts)::text,'sha256'),'hex');
 return jsonb_build_object('tripId',trip,'revision',revision,'edgeBasis','net','quote',quote,'pairs',pairs);
end$$;
create function public.read_trip_contra_snapshot(target_space_id uuid,rate_mode text default'system',vnd_per_myr text default null,display_currency text default'MYR')
returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare actor uuid:=private.require_personal_actor();result jsonb;whole boolean;
begin
 if private.space_role(target_space_id,actor)is null or not exists(select 1 from public.spaces s where s.id=target_space_id and s.type='trip'and s.status<>'voided')then raise exception using message='space_membership_required',errcode='P0001';end if;
 result:=private.contra_matrix(target_space_id,private.contra_quote(rate_mode,vnd_per_myr,display_currency));whole:=private.creator_can_record(target_space_id,actor);
 if not whole then result:=result||jsonb_build_object('pairs',(select coalesce(jsonb_agg(q),'[]')from jsonb_array_elements(result->'pairs')q where actor::text in(q->>'a',q->>'b')));end if;
 return result||jsonb_build_object('viewer',actor,'canRecord',whole);
end$$;


create function private.contra_gross_display(audit jsonb,a uuid,b uuid,quote jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
#variable_conflict use_variable
declare row jsonb;native jsonb:='[]'::jsonb;f bigint;r bigint;
begin
 for row in select q from jsonb_array_elements(audit)q loop
  f:=(row->>'aBills')::bigint-(row->>'aApplied')::bigint;r:=(row->>'bBills')::bigint-(row->>'bApplied')::bigint;
  native:=native||jsonb_build_array(jsonb_build_object('from',a,'to',b,'currency',row->>'currency','minor',greatest(f,0)+greatest(-r,0)),jsonb_build_object('from',b,'to',a,'currency',row->>'currency','minor',greatest(r,0)+greatest(-f,0)));
 end loop;return private.contra_native_pair(native,a,b,quote);
end$$;


-- Keep the existing VND quote unit for native routed coverage. The shared
-- snapshot also provides the overview's display valuation at that exact quote.
create function private.contra_net_edge(trip uuid,debtor uuid,creditor uuid,n numeric,d numeric)
returns jsonb language plpgsql stable security definer set search_path='' as $$
#variable_conflict use_variable
declare pair jsonb;q jsonb;
begin
 q:=jsonb_build_object('numerator',n::text,'denominator',d::text,'displayCurrency','MYR','rates','{}'::jsonb);pair:=private.contra_pair(trip,debtor,creditor,q);
 return jsonb_build_object('id',debtor::text||':'||creditor::text,'from',debtor,'to',creditor,'minor',case when pair->>'payer'=debtor::text then pair->'availableMinor'else'0'::jsonb end,'native',pair->'availableNative','standingNative',pair->'native','expenses',pair->'sourceVersions');
end$$;
create function private.contra_resolve_native(edge jsonb,amount bigint,n numeric,d numeric)
returns jsonb language plpgsql stable set search_path='' as $$
#variable_conflict use_variable
declare leg jsonb;work jsonb:='[]'::jsonb;out jsonb:='[]'::jsonb;updated jsonb;original bigint;covered bigint;remaining bigint;before_value bigint;after_value bigint;delta bigint;net_delta bigint:='0'::bigint;difference bigint;wanted bigint;lo bigint;hi bigint;signum int;opposite bigint:='0'::bigint;contra bigint;
begin
 if amount<0 or amount>(edge->>'minor')::bigint then raise exception using message='invalid_routed_amount',errcode='P0001';end if;
 if amount=0 then return'[]'::jsonb;end if;
 for leg in select q from jsonb_array_elements(edge->'native')q order by q->>'currency',q->>'from'loop
  original:=(leg->>'minor')::bigint;
  covered:=case when amount=(edge->>'minor')::bigint then original else least(original,private.fx_round_div(original::numeric*amount,(edge->>'minor')::numeric))end;
  before_value:=private.routed_value(original,leg->>'currency',n,d);after_value:=private.routed_value(original-covered,leg->>'currency',n,d);delta:=before_value-after_value;
  signum:=case when leg->>'from'=edge->>'from'then 1 else-1 end;net_delta:=net_delta+signum*delta;
  work:=work||jsonb_build_array(leg||jsonb_build_object('original',original,'minor',covered,'before',before_value,'delta',delta,'signum',signum));
 end loop;
 -- Quantize against before/after authoritative balances, not a silent tolerance.
 -- A single native quantum is selected only when it explains the exact native quote delta.
 difference:=amount-net_delta;
 for leg in select q from jsonb_array_elements(work)q order by case when q->>'currency'='VND'then 0 else 1 end,q->>'from'loop
  exit when difference=0;signum:=(leg->>'signum')::int;original:=(leg->>'original')::bigint;remaining:=original-(leg->>'minor')::bigint;
  wanted:=(leg->>'before')::bigint-((leg->>'delta')::bigint+signum*difference);
  if wanted<0 then continue;end if;
  if leg->>'currency'='VND'then lo:=wanted;hi:=wanted;
  else lo:=greatest(0,ceil((wanted::numeric-0.5)*100*d/n)::bigint);hi:=ceil((wanted::numeric+0.5)*100*d/n)::bigint-1;end if;
  lo:=greatest(lo,0);hi:=least(hi,original);if lo>hi then continue;end if;
  remaining:=least(greatest(remaining,lo),hi);if private.routed_value(remaining,leg->>'currency',n,d)<>wanted then continue;end if;
  delta:=(leg->>'before')::bigint-wanted;updated:=leg||jsonb_build_object('minor',original-remaining,'delta',delta);
  select jsonb_agg(case when q->>'from'=leg->>'from'and q->>'currency'=leg->>'currency'then updated else q end order by q->>'currency',q->>'from')into work from jsonb_array_elements(work)q;
  net_delta:=net_delta+signum*(delta-(leg->>'delta')::bigint);difference:=amount-net_delta;
 end loop;
 if difference<>0 then return null;end if;
 select coalesce(sum((q->>'delta')::bigint),0)::bigint into opposite from jsonb_array_elements(work)q where(q->>'signum')::int<0;
 for leg in select q from jsonb_array_elements(work)q order by q->>'currency',q->>'from'loop
  covered:=(leg->>'minor')::bigint;if covered=0 then continue;end if;delta:=(leg->>'delta')::bigint;
  if(leg->>'signum')::int<0 then contra:=delta;
  else contra:=least(opposite,delta);opposite:=opposite-contra;end if;
  out:=out||jsonb_build_array((leg-'original'-'before'-'delta'-'signum')||jsonb_build_object('edgeId',edge->>'id','application',case when(leg->>'signum')::int<0 then'contra'when contra>0 then'contra_and_repayment'else'repayment'end,'ledgerCurrency','VND','contraEquivalentMinor',contra,'repaymentEquivalentMinor',case when(leg->>'signum')::int<0 then 0 else delta-contra end));
 end loop;return out;
end$$;


create or replace function private.routed_build_core(actor uuid,trip uuid,draft jsonb,creator_mode boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare payments jsonb:=draft->'payments';p jsonb;line jsonb;e jsonb;leg jsonb;member uuid;sender uuid;receiver uuid;via uuid;k text;
 edges jsonb:='{}'::jsonb;reserved jsonb:='{}'::jsonb;ids jsonb:='{}'::jsonb;lefts jsonb:='{}'::jsonb;totals jsonb:='{}'::jsonb;lines jsonb:='[]'::jsonb;next_lines jsonb:='[]'::jsonb;issues jsonb:='[]'::jsonb;native jsonb:='[]'::jsonb;remaining jsonb:='[]'::jsonb;actors jsonb:='[]'::jsonb;sources jsonb:='[]'::jsonb;
 amount bigint;value bigint;route bigint;direct bigint;unapplied bigint;cap bigint;covered bigint;total bigint;net bigint;
 n numeric;d numeric;cash_group record;snapshot uuid;rates jsonb;quote jsonb;mode text:=draft->>'rateMode';
 net_mode boolean:=coalesce(draft->>'edgeBasis'='net',false);cq jsonb;matrix jsonb;resolved jsonb;
begin
 if creator_mode and not private.creator_can_record(trip,actor)then raise exception using message='creator_proxy_forbidden',errcode='P0001';end if;
 if actor is null or private.space_role(trip,actor)is null then raise exception using message='settlement_participant_denied',errcode='P0001';end if;
 perform 1 from public.spaces s where s.id=trip and s.type='trip'and s.status<>'voided'for share;
 if not found then raise exception using message='settlement_participant_denied',errcode='P0001';end if;
 if draft ? 'edgeBasis'or draft ? 'contraSnapshot'then
  if not net_mode or jsonb_typeof(draft->'contraSnapshot')is distinct from'object'or coalesce(draft->'contraSnapshot'->>'revision','')!~'^[a-f0-9]{64}$'or exists(select 1 from jsonb_object_keys(draft->'contraSnapshot')k where k not in('revision','displayCurrency'))then raise exception using message='invalid_contra_snapshot',errcode='P0001';end if;
  -- Writes hold the existing common financial lock and pin the rate row.
  perform 1 from tabby_fx.refresh_state r join tabby_fx.snapshots s on s.id=r.snapshot_id where r.singleton for share of r,s;
  cq:=private.contra_quote(mode,draft->>'vndPerMyr',draft->'contraSnapshot'->>'displayCurrency');matrix:=private.contra_matrix(trip,cq);
  if matrix->>'revision'is distinct from draft->'contraSnapshot'->>'revision'then raise exception using message='contra_snapshot_changed',errcode='P0001';end if;
 end if;
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
    e:=case when net_mode then private.contra_net_edge(trip,(e->>'from')::uuid,(e->>'to')::uuid,n,d)else private.routed_edge(trip,(e->>'from')::uuid,(e->>'to')::uuid,n,d)end;edges:=edges||jsonb_build_object(k,e);lefts:=lefts||jsonb_build_object(k,e->'minor');
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
  if exists(select 1 from jsonb_array_elements(payments)q where q->>'tenderCurrency'='MYR')or exists(select 1 from jsonb_each(edges)edge cross join lateral jsonb_array_elements(edge.value->'native')as native_row(value) where native_row.value->>'currency'='MYR')then
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
  if net_mode then
   resolved:=private.contra_resolve_native(e,total,n,d);
   if resolved is null then net:=-1;else native:=native||resolved;net:=total;end if;
  else
  for leg in select q from jsonb_array_elements(e->'native')q loop
   covered:=case when total=0 then 0 else least((leg->>'minor')::bigint,private.fx_round_div((leg->>'minor')::numeric*total,(e->>'minor')::numeric))end;
   if covered>0 then native:=native||jsonb_build_array(jsonb_build_object('edgeId',k,'from',leg->'from','to',leg->'to','currency',leg->'currency','minor',covered));end if;
   net:=net+case when leg->>'from'=e->>'from'then 1 else -1 end*private.routed_value(covered,leg->>'currency',n,d);
   remaining:=remaining||jsonb_build_array(jsonb_build_object('id',k||':'||(leg->>'currency')||':'||(leg->>'from'),'from',leg->'from','to',leg->'to','currency',leg->'currency','minor',(leg->>'minor')::bigint-covered));
  end loop;
  end if;
  -- No unexplained tolerance: native coverage must explain the paired value.
  if total>0 and net<>total then issues:=issues||jsonb_build_array(jsonb_build_object('code','NATIVE_PRECISION','paymentIds',totals->k));end if;
  sources:=sources||jsonb_build_array(e);
 end loop;
 if jsonb_array_length(issues)>0 then native:='[]'::jsonb;remaining:='[]'::jsonb;select jsonb_agg(q||jsonb_build_object('viaMinor',0,'directMinor',0,'unappliedMinor',q->'valueMinor'))into lines from jsonb_array_elements(lines)q;for e in select entry.value from jsonb_each(edges)entry loop remaining:=remaining||e->'native';end loop;end if;
 return jsonb_build_object('ledgerCurrency','VND','lines',lines,'issues',issues,'remaining',remaining,'rate',quote,'native',native,'sources',sources,'actors',actors)||case when net_mode then jsonb_build_object('edgeBasis','net','contraQuote',cq)else '{}'::jsonb end;
end $$;

create or replace function private.creator_normalize(draft jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
#variable_conflict use_variable
declare occurred timestamptz;links jsonb;link jsonb;result jsonb;replacement uuid;
begin
 if jsonb_typeof(draft)is distinct from'object'or exists(select 1 from jsonb_object_keys(draft)k where k not in('rateMode','vndPerMyr','snapshotId','payments','occurredAt','note','ownAccountLinks','replacementFor','edgeBasis','contraSnapshot'))then raise exception using message='creator_invalid_draft',errcode='P0001';end if;
 if coalesce(draft->>'occurredAt','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$'then raise exception using message='creator_invalid_time',errcode='P0001';end if;
 begin occurred:=(draft->>'occurredAt')::timestamptz;exception when others then raise exception using message='creator_invalid_time',errcode='P0001';end;
 if occurred is null or not isfinite(occurred)then raise exception using message='creator_invalid_time',errcode='P0001';end if;
 if draft ? 'note'and jsonb_typeof(draft->'note')is distinct from'string'or length(coalesce(draft->>'note',''))>500 then raise exception using message='creator_invalid_note',errcode='P0001';end if;
 if draft ? 'edgeBasis'or draft ? 'contraSnapshot'then
  if draft->>'edgeBasis'is distinct from'net'or jsonb_typeof(draft->'contraSnapshot')is distinct from'object'or coalesce(draft->'contraSnapshot'->>'revision','')!~'^[a-f0-9]{64}$'or exists(select 1 from jsonb_object_keys(draft->'contraSnapshot')k where k not in('revision','displayCurrency'))then raise exception using message='invalid_contra_snapshot',errcode='P0001';end if;
 end if;
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

create or replace function private.creator_post(target uuid)
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
  insert into public.financial_events(actor_participant_id,settlement_payment_id,event_type,safe_diff)values(rec.recorded_by,pid,'settlement.creator_coverage_posted',jsonb_build_object('record_id',rec.id,'currency',leg->>'currency','minor',leg->'minor')||jsonb_strip_nulls(jsonb_build_object('application',leg->'application','ledger_currency',leg->'ledgerCurrency','contra_equivalent_minor',leg->'contraEquivalentMinor','repayment_equivalent_minor',leg->'repaymentEquivalentMinor','edge_id',case when leg ? 'application'then leg->'edgeId'end)));
 end loop;
 for link in select q from jsonb_array_elements(rec.draft->'ownAccountLinks')q order by q->>'accountId',q->>'paymentId'loop perform private.creator_link_cash(rec.id,link->>'paymentId',rec.recorded_by,(link->>'accountId')::uuid);end loop;
 for e in select q from jsonb_array_elements(rec.plan->'sources')q loop states:=states||jsonb_build_array(private.routed_edge(rec.space_id,(e->>'from')::uuid,(e->>'to')::uuid,(rec.plan->'rate'->>'numerator')::numeric,(rec.plan->'rate'->>'denominator')::numeric));end loop;
 update private.creator_records set after_state=states where id=rec.id;
end$$;

create or replace function private.post_routed_proposal(target uuid)
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
  insert into public.financial_events(actor_participant_id,settlement_payment_id,event_type,safe_diff)values(public.current_participant_id(),pid,'settlement.routed_coverage_posted',jsonb_build_object('proposal_id',p.id,'currency',leg->>'currency','minor',leg->'minor')||jsonb_strip_nulls(jsonb_build_object('application',leg->'application','ledger_currency',leg->'ledgerCurrency','contra_equivalent_minor',leg->'contraEquivalentMinor','repayment_equivalent_minor',leg->'repaymentEquivalentMinor','edge_id',case when leg ? 'application'then leg->'edgeId'end)));
 end loop;
 n:=(p.plan->'rate'->>'numerator')::numeric;d:=(p.plan->'rate'->>'denominator')::numeric;
 for e in select q from jsonb_array_elements(p.plan->'sources')q loop states:=states||jsonb_build_array(private.routed_edge(p.space_id,(e->>'from')::uuid,(e->>'to')::uuid,n,d));end loop;
 update private.trip_routed_proposals set status='posted',posted_at=now(),version=version+1,after_state=states where id=p.id;
end $$;

-- Preserve every old frozen plan's projection and reversal contract.
do $legacy_projection$
declare definition text;
begin
 definition:=pg_get_functiondef('private.routed_public_plan(jsonb)'::regprocedure);
 execute replace(definition,'FUNCTION private.routed_public_plan(', 'FUNCTION private.routed_public_plan_v1(');
end
$legacy_projection$;
create function private.contra_remaining(plan jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
#variable_conflict use_variable
declare balances jsonb;rows jsonb:='[]'::jsonb;pair record;detail jsonb;legs jsonb;q jsonb:=plan->'contraQuote';
begin
 with originals as(
  select n->>'from' debtor,n->>'to' creditor,n->>'currency' currency,max((n->>'minor')::bigint) amount
  from jsonb_array_elements(plan->'sources')s cross join lateral jsonb_array_elements(coalesce(s->'standingNative',s->'native'))n group by 1,2,3
 ),reductions as(
  select n->>'from' debtor,n->>'to' creditor,n->>'currency' currency,sum((n->>'minor')::bigint)::bigint amount from jsonb_array_elements(plan->'native')n group by 1,2,3
 )select coalesce(jsonb_agg(jsonb_build_object('from',o.debtor,'to',o.creditor,'currency',o.currency,'minor',o.amount-coalesce(r.amount,0))order by o.debtor,o.creditor,o.currency),'[]')into balances from originals o left join reductions r using(debtor,creditor,currency);
 if exists(select 1 from jsonb_array_elements(balances)n where(n->>'minor')::bigint<0)then raise exception using message='invalid_contra_snapshot',errcode='P0001';end if;
 for pair in select distinct least(n->>'from',n->>'to')a,greatest(n->>'from',n->>'to')b from jsonb_array_elements(balances)n order by 1,2 loop
  select coalesce(jsonb_agg(n),'[]')into legs from jsonb_array_elements(balances)n where n->>'from'in(pair.a,pair.b)and n->>'to'in(pair.a,pair.b);
  detail:=private.contra_native_pair(legs,pair.a::uuid,pair.b::uuid,q);
  if not(detail->>'known')::boolean then detail:=private.contra_native_pair(legs,pair.a::uuid,pair.b::uuid,q||jsonb_build_object('displayCurrency','VND'));end if;
  if(detail->>'known')::boolean and(detail->>'netMinor')::bigint>0 then rows:=rows||jsonb_build_array(jsonb_build_object('id',pair.a||':'||pair.b,'from',detail->'payer','to',detail->'recipient','currency',detail->'currency','minor',detail->'netMinor'));end if;
 end loop;return rows;
end$$;
create or replace function private.routed_public_plan(plan jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
begin
 if plan->>'edgeBasis'='net'then return(private.routed_public_plan_v1(plan)-'contraQuote')||jsonb_build_object('edgeBasis','net','remaining',private.contra_remaining(plan),'remainingEstimated',true);end if;
 return private.routed_public_plan_v1(plan);
end$$;

revoke all on function private.contra_signed_outstanding(uuid,uuid,uuid,text)from public,anon,authenticated;
revoke all on function private.contra_native_audit(uuid,uuid,uuid)from public,anon,authenticated;
revoke all on function private.contra_quote(text,text,text)from public,anon,authenticated;
revoke all on function private.contra_display_value(bigint,text,jsonb)from public,anon,authenticated;
revoke all on function private.contra_native_pair(jsonb,uuid,uuid,jsonb)from public,anon,authenticated;
revoke all on function private.contra_pair(uuid,uuid,uuid,jsonb)from public,anon,authenticated;
revoke all on function private.contra_matrix(uuid,jsonb)from public,anon,authenticated;
revoke all on function private.contra_gross_display(jsonb,uuid,uuid,jsonb)from public,anon,authenticated;
revoke all on function private.contra_net_edge(uuid,uuid,uuid,numeric,numeric)from public,anon,authenticated;
revoke all on function private.contra_resolve_native(jsonb,bigint,numeric,numeric)from public,anon,authenticated;
revoke all on function private.routed_build_core(uuid,uuid,jsonb,boolean)from public,anon,authenticated;
revoke all on function private.creator_normalize(jsonb)from public,anon,authenticated;
revoke all on function private.creator_post(uuid)from public,anon,authenticated;
revoke all on function private.post_routed_proposal(uuid)from public,anon,authenticated;
revoke all on function private.contra_remaining(jsonb)from public,anon,authenticated;
revoke all on function private.routed_public_plan(jsonb)from public,anon,authenticated;
revoke all on function private.routed_public_plan_v1(jsonb)from public,anon,authenticated;
revoke all on function public.read_trip_contra_snapshot(uuid,text,text,text)from public,anon,authenticated;
grant execute on function public.read_trip_contra_snapshot(uuid,text,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
