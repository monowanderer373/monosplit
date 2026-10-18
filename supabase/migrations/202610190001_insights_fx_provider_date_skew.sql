-- Display-only FX: Frankfurter can stamp the next UTC calendar date before midnight.
-- One-day slack keeps last-good refresh from failing; far-future dates still reject.
-- No expense, participant, journal or settlement changes.
create or replace function tabby_fx.normalize_rates(p_body jsonb, p_fetched_at timestamptz)
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
    if day > ((p_fetched_at at time zone 'UTC')::date + 1) then raise exception 'future FX date'; end if;
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
