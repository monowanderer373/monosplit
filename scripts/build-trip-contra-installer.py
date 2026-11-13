"""Forward-only contra capability installer; preserve previously distributed SQL."""
from pathlib import Path
import re,hashlib,base64,textwrap
root=Path(__file__).resolve().parents[1];version='202611120001'
path=next((root/'supabase/migrations').glob(version+'_*.sql'));raw=path.read_bytes()
prior=(root/'docs/runbooks/trip-creator-production-apply.sql').read_text()
old=dict(re.findall(r"to_regprocedure\('([^']+)'\)\)is distinct from '([0-9a-f]{32})'",prior));assert len(old)==47
functions=dict(old)
# Copying the old projection preserves its OID and legacy frozen-plan contract.
functions['private.routed_public_plan_v1(jsonb)']=old['private.routed_public_plan(jsonb)']
for m in re.finditer(r'create(?: or replace)? function ([\w.]+)\((.*?)\)\s*returns.*?\bas \$\$(.*?)\$\$;',raw.decode(),re.S|re.I):
 name,args,body=m.groups();types=','.join(re.split(r'\s+',a.strip())[1]for a in args.split(',')if a.strip());functions[name+'('+types+')']=hashlib.md5(body.encode()).hexdigest()
baseline=sorted(p.name.split('_')[0]for p in(root/'supabase/migrations').glob('*.sql')if p.name.split('_')[0]<version)
sha=hashlib.sha256(raw).hexdigest()
out="-- COMPLETE: existing Tabby Tally skiqsxvmxvmxfzhrzcxh with creator proxy installed.\n-- Adds shared bilateral contra snapshots and explicit-net coverage. Does not record payments or change balances.\nbegin;\nset local lock_timeout='10s';\nselect pg_advisory_xact_lock(hashtextextended('tabby.personal-periods.migration',0));\ndo $contra_install$\ndeclare migration_sql text;\nbegin\n"
out+=f" if(select array_agg(version order by version)from supabase_migrations.schema_migrations where version<>'{version}')is distinct from array[{','.join(repr(v)for v in baseline)}]::text[]then raise exception 'Unexpected contra baseline: installed creator proxy required';end if;\n"
def checks(items,prefix):
 result=''
 for sig,digest in items.items():
  result+=f" if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('{sig}'))is distinct from '{digest}'then raise exception 'Unexpected {prefix} function: {sig}';end if;\n"
  result+=f" if has_function_privilege('anon','{sig}','EXECUTE')or has_function_privilege('authenticated','{sig}','EXECUTE')is distinct from {'true'if sig.startswith('public.')else'false'} then raise exception 'Unexpected contra function privileges';end if;\n"
 return result
out+=f" if not exists(select 1 from supabase_migrations.schema_migrations where version='{version}')then\n"+checks(old,'pre-contra')
out+=f""" -- Canonical SHA256 {sha}
 migration_sql:=convert_from(decode($contra_payload$
{textwrap.fill(base64.b64encode(raw).decode(),100)}
$contra_payload$,'base64'),'UTF8');
 if encode(extensions.digest(migration_sql,'sha256'),'hex')<>'{sha}'then raise exception 'Incomplete contra payload';end if;
 execute replace(regexp_replace(migration_sql,'commit;\\s*$','','i'),E'begin;\\n','');
 insert into supabase_migrations.schema_migrations(version,name,statements)values('{version}','{path.stem[len(version)+1:]}',array[migration_sql]);
 end if;
"""
out+=checks(functions,'contra')
out+=" if(select provolatile from pg_proc where oid='private.creator_normalize(jsonb)'::regprocedure)<>'s'then raise exception 'Unexpected creator normalizer volatility';end if;\n"
out+="end;\n$contra_install$;\nnotify pgrst,'reload schema';\ncommit;\nselect 'TABBY_TRIP_CONTRA_INSTALL_COMPLETE_20261112' as installation_status;\n"
(root/'docs/runbooks/trip-contra-production-apply.sql').write_text(out);print('Contra installer:',len(out.encode()),'bytes;',len(functions),'final function fingerprints')
