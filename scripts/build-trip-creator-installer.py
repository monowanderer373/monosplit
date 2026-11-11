"""Build the standalone creator-proxy installer. Frozen previously distributed installers remain untouched."""
from pathlib import Path
import re,hashlib,base64,textwrap
root=Path(__file__).resolve().parents[1]
version='202611110001';path=next((root/'supabase/migrations').glob(version+'_*.sql'));raw=path.read_bytes()
prior=(root/'docs/runbooks/trip-routed-production-apply.sql').read_text()
functions=dict(re.findall(r"to_regprocedure\('([^']+)'\)\)is distinct from '([0-9a-f]{32})'",prior))
assert len(functions)==24
for m in re.finditer(r'create(?: or replace)? function ([\w.]+)\((.*?)\)\s*returns.*?\bas \$\$(.*?)\$\$;',raw.decode(),re.S|re.I):
 name,args,body=m.groups();types=','.join(re.split(r'\s+',a.strip())[1]for a in args.split(',')if a.strip());functions[name+'('+types+')']=hashlib.md5(body.encode()).hexdigest()
assert len(functions)==47
baseline=sorted(p.name.split('_')[0]for p in(root/'supabase/migrations').glob('*.sql')if p.name.split('_')[0]<version)
sha=hashlib.sha256(raw).hexdigest()
out="-- COMPLETE: existing Tabby Tally skiqsxvmxvmxfzhrzcxh, already installed routed V2.\n-- Installs creator-proxy capability only. Does not record payments, change balances or Reset.\nbegin;\nset local lock_timeout='10s';\nselect pg_advisory_xact_lock(hashtextextended('tabby.personal-periods.migration',0));\ndo $creator_install$\ndeclare migration_sql text;\nbegin\n"
out+=f" if(select array_agg(version order by version)from supabase_migrations.schema_migrations where version<>'{version}')is distinct from array[{','.join(repr(v)for v in baseline)}]::text[]then raise exception 'Unexpected creator-proxy baseline: routed V2 required';end if;\n"
out+=f""" if not exists(select 1 from supabase_migrations.schema_migrations where version='{version}')then
 -- Canonical SHA256 {sha}
 migration_sql:=convert_from(decode($creator_payload$
{textwrap.fill(base64.b64encode(raw).decode(),100)}
$creator_payload$,'base64'),'UTF8');
 if encode(extensions.digest(migration_sql,'sha256'),'hex')<>'{sha}'then raise exception 'Incomplete creator-proxy payload';end if;
 execute replace(regexp_replace(migration_sql,'commit;\\s*$','','i'),E'begin;\\n','');
 insert into supabase_migrations.schema_migrations(version,name,statements)values('{version}','{path.stem[len(version)+1:]}',array[migration_sql]);
 end if;
"""
for sig,digest in functions.items():
 out+=f" if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('{sig}'))is distinct from '{digest}'then raise exception 'Unexpected creator-proxy function: {sig}';end if;\n"
 out+=f" if has_function_privilege('anon','{sig}','EXECUTE')or has_function_privilege('authenticated','{sig}','EXECUTE')is distinct from {'true'if sig.startswith('public.')else'false'} then raise exception 'Unexpected creator-proxy function privileges';end if;\n"
for table in ['creator_policies','creator_grants','creator_reviews','creator_records','creator_receipts','creator_corrections','creator_audit','creator_outbox']:
 out+=f" if has_table_privilege('authenticated','private.{table}','SELECT,INSERT,UPDATE,DELETE')or has_table_privilege('anon','private.{table}','SELECT,INSERT,UPDATE,DELETE')or not(select relrowsecurity from pg_class where oid='private.{table}'::regclass)then raise exception 'Unexpected creator-proxy table privileges';end if;\n"
out+=" if(select provolatile from pg_proc where oid='private.creator_normalize(jsonb)'::regprocedure)<>'s'then raise exception 'Unexpected creator normalizer volatility';end if;\n"
out+=" if not(select relrowsecurity from pg_class where oid='public.creator_settlement_notices'::regclass)or has_table_privilege('authenticated','public.creator_settlement_notices','INSERT,UPDATE,DELETE')or not has_table_privilege('authenticated','public.creator_settlement_notices','SELECT')then raise exception 'Unexpected notice security';end if;\n"
out+="end;\n$creator_install$;\nnotify pgrst,'reload schema';\ncommit;\nselect 'TABBY_CREATOR_PROXY_INSTALL_COMPLETE_20261111' as installation_status;\n"
(root/'docs/runbooks/trip-creator-production-apply.sql').write_text(out);print('Creator-proxy installer:',len(out.encode()),'bytes;47 final function fingerprints')
