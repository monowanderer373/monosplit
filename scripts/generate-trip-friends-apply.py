"""Generate a guarded, repeatable installer for existing Tabby Tally only."""
from pathlib import Path
import base64,hashlib,re,textwrap
root=Path(__file__).resolve().parents[1]
version='202610280001';name=version+'_trip_friend_requests.sql'
prior=sorted(p.name.split('_')[0]for p in(root/'supabase/migrations').glob('*.sql')if p.name.split('_')[0]<version)
assert len(prior)==32 and prior[-1]=='202610260001'
source=(root/'supabase/migrations'/name).read_text()
assert source.count('\nbegin;\n')==1 and source.endswith('commit;\n')
body=source.replace('\nbegin;\n','\n',1).removesuffix('commit;\n')
payload=textwrap.fill(base64.b64encode(body.encode()).decode(),76)
digest=hashlib.sha256(body.encode()).hexdigest()
checks=[]
for function,params,definition in re.findall(r'create function (public\.\w+)\((.*?)\)\s*returns .*?as \$\$(.*?)\$\$;',body,re.S):
 signature=function+'('+','.join(part.strip().split()[-1]for part in params.split(','))+')'
 hashed=hashlib.sha256(definition.encode()).hexdigest()
 checks.append(f" if(select encode(extensions.digest(replace(prosrc,chr(13)||chr(10),chr(10)),'sha256'),'hex')from pg_catalog.pg_proc where oid='{signature}'::regprocedure)is distinct from '{hashed}'then raise exception 'Unexpected installed function: {function}';end if;")
assert len(checks)==3
expected=','.join("'"+v+"'"for v in prior)
text=f'''-- COMPLETE FILE: existing Tabby Tally / skiqsxvmxvmxfzhrzcxh ONLY.
-- Schema-only install. Sends no friend request, accepts nobody, changes no financial facts.
-- Existing32 migrations required. Does not reset databases or modify deployed migration history.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('tabby.trip-friends.install',0));
do $tabby_trip_friends_install$
declare migration_sql text;
begin
 if(select array_agg(version order by version)from supabase_migrations.schema_migrations where version<>'{version}')is distinct from array[{expected}]::text[]then raise exception 'Unexpected Tabby migration baseline';end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='{version}')then
  migration_sql:=convert_from(decode($tabby_payload$
{payload}
$tabby_payload$,'base64'),'UTF8');
  if encode(extensions.digest(migration_sql,'sha256'),'hex')<>'{digest}'then raise exception 'Incomplete migration payload';end if;
  execute migration_sql;
  insert into supabase_migrations.schema_migrations(version,name,statements)values('{version}','trip_friend_requests',array[migration_sql]);
 end if;
{chr(10).join(checks)}
 if has_table_privilege('authenticated','public.trip_friend_requests','UPDATE')or has_table_privilege('authenticated','private.trip_friend_command_receipts','SELECT')or has_function_privilege('anon','public.send_trip_friend_request(uuid,uuid,uuid)','EXECUTE')then raise exception 'Unexpected friend request privileges';end if;
 if not(select relrowsecurity from pg_class where oid='public.trip_friend_requests'::regclass)then raise exception 'Missing request RLS';end if;
end;
$tabby_trip_friends_install$;
notify pgrst,'reload schema';
commit;
select 'TABBY_TRIP_FRIENDS_INSTALL_COMPLETE_20261028' as installation_status;
'''
(root/'docs/runbooks/trip-friends-production-apply.sql').write_text(text)
print('Generated guarded Trip friend installer, canonical body SHA256 '+digest)
