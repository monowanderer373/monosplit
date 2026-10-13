-- Display-only FX metadata. No expense, participant, journal or settlement changes.
create extension if not exists http with schema extensions;
create extension if not exists pg_cron;
create schema if not exists tabby_fx;
revoke all on schema tabby_fx from public, anon, authenticated, service_role;

create table tabby_fx.snapshots (
  id uuid primary key default gen_random_uuid(),
  fetched_at timestamptz not null default now(),
  rates jsonb not null check (jsonb_typeof(rates) = 'object')
);
create table tabby_fx.refresh_state (
  singleton boolean primary key default true check (singleton),
  snapshot_id uuid references tabby_fx.snapshots,
  attempted_at timestamptz,
  succeeded_at timestamptz,
  retry_after timestamptz,
  failure text check (failure in ('provider_unavailable','rate_limited','invalid_response'))
);
insert into tabby_fx.refresh_state(singleton) values (true);
alter table tabby_fx.snapshots enable row level security;
alter table tabby_fx.refresh_state enable row level security;
revoke all on all tables in schema tabby_fx from public, anon, authenticated, service_role;

-- Keep decimal text as returned by JSON, not a binary floating point conversion.
create function tabby_fx.normalize_rates(p_body jsonb, p_fetched_at timestamptz)
returns jsonb language plpgsql stable set search_path = '' as $$
declare item jsonb; result jsonb := '{}'::jsonb; code text; rate numeric; day date;
begin
  if jsonb_typeof(p_body) <> 'array' then raise exception 'invalid FX response'; end if;
  for item in select value from jsonb_array_elements(p_body) loop
    code := item->>'quote';
    if coalesce(item->>'base','') <> 'MYR' or coalesce(code,'') <> all(array['AUD','CNY','EUR','GBP','HKD','JPY','KRW','SGD','THB','TWD','USD','VND']) then
      raise exception 'invalid FX pair';
    end if;
    if result ? code then raise exception 'duplicate FX pair'; end if;
    if coalesce(item->>'rate','') !~ '^[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
       or length(item->>'rate') > 80 then raise exception 'invalid FX rate'; end if;
    rate := (item->>'rate')::numeric;
    if rate <= 0 or rate > 1e15 or rate < 1e-15 then raise exception 'invalid FX rate'; end if;
    if coalesce(item->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'invalid FX date'; end if;
    day := (item->>'date')::date;
    if day > (p_fetched_at at time zone 'UTC')::date then raise exception 'future FX date'; end if;
    result := result || jsonb_build_object(code, jsonb_build_object(
      'currency',code,'quote','MYR','numerator','1','denominator',rate::text,
      'direction','MYR-per-foreign','originalBase','MYR','originalQuote',code,
      'originalRate',rate::text,'rateDate',day::text,'fetchedAt',p_fetched_at,
      'provider','Frankfurter','providerKeys',(select coalesce(jsonb_agg(v->>'key'),'[]'::jsonb) from jsonb_array_elements(coalesce(item->'providers','[]'::jsonb)) v where coalesce((v->>'excluded')::boolean,false)=false),
      'mode','blended-reference'));
  end loop;
  if result = '{}'::jsonb then raise exception 'empty FX response'; end if;
  return result;
end $$;
revoke all on function tabby_fx.normalize_rates(jsonb,timestamptz) from public, anon, authenticated, service_role;

create function tabby_fx.refresh(p_force boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare state tabby_fx.refresh_state; response extensions.http_response;
  rates jsonb; previous jsonb; next_id uuid; fetched timestamptz := clock_timestamp();
begin
  -- One global provider batch, including concurrent cold starts. Never per transaction/user.
  if not pg_try_advisory_xact_lock(131310,1) then return; end if;
  select * into state from tabby_fx.refresh_state where singleton;
  if not p_force and (state.retry_after > fetched or state.succeeded_at > fetched - interval '24 hours') then return; end if;
  update tabby_fx.refresh_state set attempted_at=fetched, retry_after=fetched+interval '5 minutes' where singleton;
  begin
    perform set_config('http.curlopt_timeout_ms','10000',true);
    perform set_config('http.curlopt_connecttimeout_ms','4000',true);
    select * into response from extensions.http_get('https://api.frankfurter.dev/v2/rates?base=MYR&quotes=AUD,CNY,EUR,GBP,HKD,JPY,KRW,SGD,THB,TWD,USD,VND&expand=providers');
    if response.status = 429 then
      update tabby_fx.refresh_state set failure='rate_limited',retry_after=fetched+interval '1 hour' where singleton;
      return;
    elsif response.status <> 200 then
      update tabby_fx.refresh_state set failure='provider_unavailable',retry_after=fetched+interval '15 minutes' where singleton;
      return;
    end if;
    rates := tabby_fx.normalize_rates(response.content::jsonb,fetched);
    select s.rates into previous from tabby_fx.snapshots s where s.id=state.snapshot_id;
    -- Missing/unsupported currencies preserve last-good metadata and its own dates.
    rates := coalesce(previous,'{}'::jsonb) || rates;
    insert into tabby_fx.snapshots(rates,fetched_at) values(rates,fetched) returning id into next_id;
    update tabby_fx.refresh_state set snapshot_id=next_id,succeeded_at=fetched,failure=null,retry_after=fetched+interval '24 hours' where singleton;
  exception when others then
    -- No raw response, URLs, private data or secrets in audit. Last-good is never deleted.
    update tabby_fx.refresh_state set failure='invalid_response',retry_after=fetched+interval '15 minutes' where singleton;
  end;
end $$;
revoke all on function tabby_fx.refresh(boolean) from public, anon, authenticated, service_role;

-- Authenticated read boundary; clients cannot submit quotes, URLs, amounts or write cache.
create function public.insights_fx_snapshot(p_snapshot_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare snap tabby_fx.snapshots; state tabby_fx.refresh_state;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_snapshot_id is null then perform tabby_fx.refresh(false); end if;
  select * into state from tabby_fx.refresh_state where singleton;
  select * into snap from tabby_fx.snapshots where id=coalesce(p_snapshot_id,state.snapshot_id);
  return jsonb_build_object('id',snap.id,'rates',coalesce(snap.rates,'{}'::jsonb),
    'fetchedAt',snap.fetched_at,'basis','latest-reference','targetCurrency','MYR',
    'status',case when snap.id is null then 'unavailable'
      when state.failure is not null or snap.fetched_at < now()-interval '24 hours' then 'cached' else 'fresh' end,
    'retryAfter',state.retry_after);
end $$;
revoke all on function public.insights_fx_snapshot(uuid) from public,anon,service_role;
grant execute on function public.insights_fx_snapshot(uuid) to authenticated;

-- 09:10 UTC / 17:10 Malaysia. Cron executes as migration owner, no task/client secret.
select cron.schedule('tabby-insights-frankfurter-daily','10 9 * * *','select tabby_fx.refresh(true);');
