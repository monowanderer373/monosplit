"""Generate ONLY the forward session-confirmation policy update for existing001+002."""
from pathlib import Path
import base64,hashlib,re,textwrap
root=Path(__file__).resolve().parents[1]
name='202610250003_personal_period_session_confirmation.sql'
version,label=name.removesuffix('.sql').split('_',1)
prior=sorted(p.name.split('_')[0]for p in(root/'supabase/migrations').glob('*.sql')if p.name.split('_')[0]<version)
assert len(prior)==30 and prior[-2:]==['202610250001','202610250002'],'Review current installed baseline.'
expected=','.join("'"+v+"'"for v in prior)
sql=(root/'supabase/migrations'/name).read_text();delimiter='$tabby_session_confirmation_payload$';assert delimiter not in sql
payload=textwrap.fill(base64.b64encode(sql.encode('utf-8')).decode('ascii'),76)
migration_digest=hashlib.sha256(sql.encode('utf-8')).hexdigest()
definitions={m[1]:m[2]for m in re.finditer(r'create or replace function (public\.\w+)\(.*?\bas\s*\$\$(.*?)\$\$;',sql,re.S)}
assert len(definitions)==2
checks=[]
for signature,qualified in [('public.apply_personal_fresh_start(uuid,uuid,jsonb)','public.apply_personal_fresh_start'),('public.get_personal_ledger_period_state()','public.get_personal_ledger_period_state')]:
 digest=hashlib.sha256(definitions[qualified].encode()).hexdigest()
 checks.append(f" if(select pg_catalog.encode(extensions.digest(pg_catalog.replace(prosrc,pg_catalog.chr(13)||pg_catalog.chr(10),pg_catalog.chr(10)),'sha256'),'hex')from pg_catalog.pg_proc where oid='{signature}'::regprocedure)is distinct from '{digest}'then raise exception 'Unexpected session-confirmation function body: {qualified}';end if;\n")
body_checks=''.join(checks)
body=f"""-- COMPLETE FILE V2: existing Tabby Tally / skiqsxvmxvmxfzhrzcxh only.
-- New003 ONLY; keeps installed001/002 intact. Does not execute Fresh Start.
-- Policy change authorized by user: current login + explicit confirmation, no reauthentication.
-- Canonical UTF-8 migration payload SHA256 {migration_digest}
-- Encoding preserves function text through editor formatting; exact hashes remain required.
begin;
set local lock_timeout='10s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tabby.personal-periods.migration',0));
do $tabby_session_confirmation_apply$
declare migration_sql text;
begin
 if(select pg_catalog.array_agg(version order by version)from supabase_migrations.schema_migrations where version<>'{version}')
 is distinct from array[{expected}]::text[] then
  raise exception 'Unexpected Tabby migration history. Existing001+002 are required.';end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='{version}')then
  migration_sql:=pg_catalog.convert_from(pg_catalog.decode({delimiter}
{payload}
{delimiter},'base64'),'UTF8');
  if pg_catalog.encode(extensions.digest(migration_sql,'sha256'),'hex')<>'{migration_digest}'then
   raise exception 'Session confirmation migration payload checksum mismatch.';end if;
  execute migration_sql;
  insert into supabase_migrations.schema_migrations(version,name,statements)values('{version}','{label}',array[migration_sql]);
 end if;
 if pg_catalog.to_regprocedure('private.personal_period_opening_locks(uuid)')is null
 or pg_catalog.strpos(pg_catalog.pg_get_functiondef('public.get_personal_ledger_period_state()'::regprocedure),'fresh_start_confirmation_version')=0
 or pg_catalog.strpos(pg_catalog.pg_get_functiondef('public.apply_personal_fresh_start(uuid,uuid,jsonb)'::regprocedure),'fresh_start_reauthentication_required')<>0
 or not pg_catalog.has_function_privilege('authenticated','public.apply_personal_fresh_start(uuid,uuid,jsonb)','EXECUTE')
 or pg_catalog.has_function_privilege('anon','public.apply_personal_fresh_start(uuid,uuid,jsonb)','EXECUTE')then
  raise exception 'Session confirmation safeguards are incomplete.';end if;
{body_checks}end $tabby_session_confirmation_apply$;
notify pgrst,'reload schema';
commit;
select 'TABBY_FRESH_START_SESSION_CONFIRMATION_COMPLETE_20261025_V2' as result;
-- END OF COMPLETE FILE
"""
path=root/'docs/runbooks/personal-confirmation-production-apply.sql';path.write_text(body)
print(f'Generated {path.relative_to(root)} ({path.stat().st_size} bytes), schema-only003.')
