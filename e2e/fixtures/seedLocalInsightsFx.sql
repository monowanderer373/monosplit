-- Local disposable cache only. Display-only last-good so Insights e2e does not
-- depend on Frankfurter stamping a UTC date ahead of the runner clock.
do $seed$
declare next_id uuid;
begin
  insert into tabby_fx.snapshots(rates, fetched_at)
  values (
    jsonb_build_object(
      'JPY', jsonb_build_object(
        'currency','JPY','quote','MYR','numerator','1','denominator','33',
        'direction','MYR-per-foreign','originalBase','MYR','originalQuote','JPY',
        'originalRate','33','rateDate','2026-10-16','fetchedAt', now(),
        'provider','Frankfurter','providerKeys','[]'::jsonb,'mode','blended-reference'
      )
    ),
    now()
  )
  returning id into next_id;
  update tabby_fx.refresh_state
     set snapshot_id = next_id,
         attempted_at = now(),
         succeeded_at = now(),
         failure = null,
         retry_after = now() + interval '24 hours'
   where singleton;
end
$seed$;
