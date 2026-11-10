"""Complete batch001+002+routed installer; no financial posting or history replay."""
from pathlib import Path
import re,hashlib,base64,textwrap
root=Path(__file__).resolve().parents[1];version='202611100001';path=next((root/'supabase/migrations').glob(version+'_*.sql'));raw=path.read_bytes();sql=raw.decode();sha=hashlib.sha256(raw).hexdigest()
base=(root/'docs/runbooks/trip-batch-production-apply.sql').read_text();base=base[:base.rindex('commit;')]
base=base.replace("version not in('202611050001','202611050002')", "version not in('202611050001','202611050002','202611100001')")
functions=[]
for m in re.finditer(r'create(?: or replace)? function ([\w.]+)\((.*?)\)\s*returns.*?\bas \$\$(.*?)\$\$;',sql,re.S|re.I):
 name,args,body=m.groups();types=','.join(re.split(r'\s+',a.strip())[1]for a in args.split(','));functions.append((name+'('+types+')',hashlib.md5(body.encode()).hexdigest()))
assert len(functions)==12
baseline=sorted(p.name.split('_')[0]for p in(root/'supabase/migrations').glob('*.sql')if p.name.split('_')[0]<version)
output='-- COMPLETE: existing Tabby Tally skiqsxvmxvmxfzhrzcxh. Installs batch001+002 and routed settlement.\n-- Does not register payments, modify balances, confirm, reverse or Reset.\n'+base
output+='''do $tabby_routed_install$
declare migration_sql text;
begin
'''
output+=f" if(select array_agg(version order by version)from supabase_migrations.schema_migrations where version<>'{version}')is distinct from array[{','.join(repr(v)for v in baseline)}]::text[]then raise exception 'Unexpected routed migration baseline';end if;\n"
output+=f""" if not exists(select 1 from supabase_migrations.schema_migrations where version='{version}')then
  -- Canonical SHA256 {sha}
  migration_sql:=convert_from(decode($tabby_routed_payload$
{textwrap.fill(base64.b64encode(raw).decode(),100)}
$tabby_routed_payload$,'base64'),'UTF8');
  if encode(extensions.digest(migration_sql,'sha256'),'hex')<>'{sha}'then raise exception 'Incomplete routed payload';end if;
  execute replace(regexp_replace(migration_sql,'commit;\\s*$','','i'),E'begin;\\n','');
  insert into supabase_migrations.schema_migrations(version,name,statements)values('{version}','{path.stem[len(version)+1:]}',array[migration_sql]);
 end if;
"""
for sig,digest in functions:
 output+=f" if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('{sig}'))is distinct from '{digest}'then raise exception 'Unexpected routed function: {sig}';end if;\n"
 if sig.startswith('private.'):
  output+=f" if has_function_privilege('anon','{sig}','EXECUTE')or has_function_privilege('authenticated','{sig}','EXECUTE')then raise exception 'Private routed helper exposed';end if;\n"
 else:output+=f" if has_function_privilege('anon','{sig}','EXECUTE')or not has_function_privilege('authenticated','{sig}','EXECUTE')then raise exception 'Unexpected routed RPC privileges';end if;\n"
for table in['trip_routed_proposals','trip_routed_approvals','trip_routed_receipts']:
 output+=f" if has_table_privilege('authenticated','private.{table}','SELECT,INSERT,UPDATE,DELETE')or has_table_privilege('anon','private.{table}','SELECT,INSERT,UPDATE,DELETE')or not(select relrowsecurity from pg_class where oid='private.{table}'::regclass)then raise exception 'Unexpected routed table security';end if;\n"
output+="end;\n$tabby_routed_install$;\nnotify pgrst,'reload schema';\ncommit;\nselect 'TABBY_TRIP_ROUTED_INSTALL_COMPLETE_20261110' as installation_status;\n"
(root/'docs/runbooks/trip-routed-production-apply.sql').write_text(output);print('Generated complete routed installer',len(output.encode()),'bytes,24 final function fingerprints')
