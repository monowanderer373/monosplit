-- Short transport for the unchanged, immutable Contra installer.
-- Run this entire file in the existing project's SQL Editor as postgres.
-- Downloads public SQL only; never sends credentials or financial data.
begin;
do $contra_download$
declare
  response extensions.http_response;
  installer text;
begin
  perform set_config('http.curlopt_connecttimeout_ms','10000',true);
  perform set_config('http.curlopt_timeout_ms','30000',true);
  select * into response from extensions.http_get(
    'https://raw.githubusercontent.com/monowanderer373/monosplit/16fcbb7d9d9eba1129fde718838a9319dbb6d2a0/docs/runbooks/trip-contra-production-apply.sql'
  );
  if response.status is distinct from 200 then
    raise exception 'Contra download failed (HTTP %); no installation committed',response.status;
  end if;
  if octet_length(response.content) is distinct from 136448 or
     encode(extensions.digest(response.content,'sha256'),'hex') is distinct from
     'ae9f32512c617ba993ebae8a794f8acd0db0a5765fe77b6fe6bc7ed4d94329ba' then
    raise exception 'Contra download incomplete or changed; no installation committed';
  end if;
  -- The verified file has its own outer transaction. Reuse this transaction
  -- while preserving every baseline, payload, function and privilege check.
  installer := replace(replace(response.content,E'\nbegin;\n',E'\n'),E'\ncommit;\n',E'\n');
  if length(response.content)-length(installer) <> 15 then
    raise exception 'Unexpected Contra transaction wrapper; no installation committed';
  end if;
  execute installer;
end;
$contra_download$;
commit;
select 'TABBY_TRIP_CONTRA_INSTALL_COMPLETE_20261112' as installation_status;
