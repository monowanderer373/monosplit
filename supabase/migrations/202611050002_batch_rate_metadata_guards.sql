-- Validate Custom VND precision/range on source conversion as well as VND cash.
-- Require complete metadata for System cash-only conversion. No financial writes.
begin;
do $batch_rate_guards$
declare definition text;patched text;
begin
 if(select md5(prosrc)from pg_proc where oid='private.trip_batch_review(uuid,uuid,text,text,uuid,jsonb)'::regprocedure)is distinct from 'ed809a8ee34f82d1e7a6fd0f24946a62'then raise exception 'Unexpected batch rate baseline';end if;
 definition:=pg_get_functiondef('private.trip_batch_review(uuid,uuid,text,text,uuid,jsonb)'::regprocedure);
 patched:=replace(definition,$old_custom$  custom_rates:=jsonb_build_object('VND',vnd_per_myr);
  if coalesce(vnd_per_myr,'')~'^[0-9]{1,12}(\.[0-9]{1,12})?$' and vnd_per_myr::numeric>0 then vr:=jsonb_build_object('numerator',vnd_per_myr,'denominator','1','source','custom','provider','Custom');end if;$old_custom$,$new_custom$  -- Invalid/oversized rates must never reach the legacy unrestricted Custom calculator.
  -- Identity-only MYR still needs no FX, even when an unused Custom draft is incomplete.
  custom_rates:='{"VND":"0"}'::jsonb;
  if coalesce(vnd_per_myr,'')~'^[0-9]{1,12}(\.[0-9]{1,12})?$' then
   if vnd_per_myr::numeric>0 then
    custom_rates:=jsonb_build_object('VND',vnd_per_myr);
    vr:=jsonb_build_object('numerator',vnd_per_myr,'denominator','1','source','custom','provider','Custom');
   end if;
  end if;$new_custom$);
 patched:=replace(patched,$old_cash$   if vr is null or vr->>'provider' is null then raise exception using message='fx_rate_unavailable',errcode='P0001';end if;$old_cash$,$new_cash$   if vr is null and rate_mode='custom' then raise exception using message='invalid_rate',errcode='P0001';end if;
   if vr is null or coalesce(vr->>'provider','')='' or(rate_mode='system' and coalesce(vr->>'rateDate','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$')then raise exception using message='fx_rate_unavailable',errcode='P0001';end if;$new_cash$);
 if patched=definition then raise exception 'Missing batch rate guards';end if;
 execute patched;
 if(select md5(prosrc)from pg_proc where oid='private.trip_batch_review(uuid,uuid,text,text,uuid,jsonb)'::regprocedure)is distinct from 'f4993ca37a0cf26ecb0759bb9c48b2aa'then raise exception 'Unexpected batch rate guards';end if;
end;
$batch_rate_guards$;
notify pgrst,'reload schema';
commit;
