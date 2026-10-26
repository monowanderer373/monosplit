"""Reproducible schema-only installer for the explicit full-reset revision."""
from pathlib import Path
import re,base64,hashlib,textwrap
root=Path(__file__).resolve().parents[1];name='202610260001_shared_restart.sql';version,label=name[:-4].split('_',1)
prior=sorted(p.name.split('_')[0]for p in(root/'supabase/migrations').glob('*.sql')if p.name.split('_')[0]<version)
assert len(prior)==31
source=(root/'supabase/migrations'/name).read_text();source=re.sub(r'(?m)^begin;\s*$', '',source,count=1);source=re.sub(r'(?m)^commit;\s*$', '',source)
checks=[]
for m in re.finditer(r'create(?: or replace)? function ([\w.]+)\((.*?)\).*?\bas\s*\$\$(.*?)\$\$;',source,re.S|re.I):
 name,args,body=m.groups();types=','.join(a.strip().split()[1]for a in args.split(',')if a.strip());signature=f'{name}({types})';digest=hashlib.sha256(body.encode()).hexdigest()
 checks.append(f" if(select encode(extensions.digest(replace(prosrc,chr(13)||chr(10),chr(10)),'sha256'),'hex')from pg_proc where oid='{signature}'::regprocedure)is distinct from '{digest}'then raise exception 'Unexpected shared-reset function: {signature}';end if;")
assert len(checks)>=17,len(checks)
digest=hashlib.sha256(source.encode()).hexdigest();payload=textwrap.fill(base64.b64encode(source.encode()).decode(),76);baseline=','.join("'"+v+"'"for v in prior)
script=f'''-- COMPLETE FILE: existing Tabby Tally project skiqsxvmxvmxfzhrzcxh only.
-- Installs shared-reset capability. Does NOT execute Reset, clear debt, or post money.
-- Canonical payload SHA256 {digest}
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('tabby.personal-periods.migration',0));
do $shared_restart_install$
declare migration_sql text;
begin
 if(select array_agg(version order by version)from supabase_migrations.schema_migrations where version<>'{version}')is distinct from array[{baseline}]::text[]then raise exception 'Unexpected migration baseline: installed003 required';end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='{version}')then
 migration_sql:=convert_from(decode($canonical_shared_restart_payload$
{payload}
$canonical_shared_restart_payload$,'base64'),'UTF8');
 if encode(extensions.digest(migration_sql,'sha256'),'hex')<>'{digest}'then raise exception 'Shared reset payload checksum mismatch';end if;
 execute migration_sql;
 insert into supabase_migrations.schema_migrations(version,name,statements)values('{version}','{label}',array[migration_sql]);
 end if;
{chr(10).join(checks)}
 if has_function_privilege('anon','public.apply_personal_fresh_start_v2(uuid,uuid,jsonb)','EXECUTE')or not has_function_privilege('authenticated','public.apply_personal_fresh_start_v2(uuid,uuid,jsonb)','EXECUTE')then raise exception 'Invalid full-reset permissions';end if;
end $shared_restart_install$;
notify pgrst,'reload schema';
commit;
select 'TABBY_SHARED_RESTART_INSTALL_COMPLETE_20261026' as result;
-- END OF COMPLETE FILE
'''
p=root/'docs/runbooks/shared-restart-production-apply.sql';p.write_text(script);print(f'Generated {p.relative_to(root)}: {p.stat().st_size} bytes; {len(checks)} exact function checks; installation only.')
