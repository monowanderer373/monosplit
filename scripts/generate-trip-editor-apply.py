"""Schema-only, baseline-guarded Issue07 installer for the existing project."""
from pathlib import Path
import base64
import hashlib
import re
import textwrap

root = Path(__file__).resolve().parents[1]
version = '202610310001'
source = (root / 'supabase/migrations' / (version + '_unified_trip_expense_editor.sql')).read_text()
assert source.count('\nbegin;\n') == 1 and source.endswith('commit;\n')
body = source.replace('\nbegin;\n', '\n', 1).removesuffix('commit;\n')
prior = sorted(p.name.split('_')[0] for p in (root / 'supabase/migrations').glob('*.sql') if p.name.split('_')[0] < version)
assert len(prior) == 33 and prior[-1] == '202610280001'
signatures = {
    'private.link_personal_trip_expense': 'uuid,uuid,uuid',
    'private.save_trip_editor_settings': 'uuid,uuid[],text,jsonb',
    'public.get_trip_expense_editor': 'uuid',
    'public.save_trip_expense_editor': 'uuid,uuid,integer,uuid,text,boolean,jsonb,uuid[],text,jsonb',
    'public.create_trip_expense_editor': 'uuid,uuid,jsonb,uuid[],jsonb,uuid,text,jsonb',
    'public.reconcile_trip_expense_editor': 'uuid',
}
checks = []
for name, args in signatures.items():
    match = re.search(r'create function ' + re.escape(name) + r'\(.*?as \$\$(.*?)\$\$;', body, re.S)
    assert match, name
    hashed = hashlib.sha256(match[1].encode()).hexdigest()
    checks.append(f" if(select encode(extensions.digest(replace(prosrc,chr(13)||chr(10),chr(10)),'sha256'),'hex')from pg_catalog.pg_proc where oid='{name}({args})'::regprocedure)is distinct from '{hashed}'then raise exception 'Unexpected Issue07 function: {name}';end if;")
payload = textwrap.fill(base64.b64encode(body.encode()).decode(), 76)
expected = ','.join("'" + v + "'" for v in prior)
digest = hashlib.sha256(body.encode()).hexdigest()
text = f'''-- COMPLETE FILE: existing Tabby Tally / skiqsxvmxvmxfzhrzcxh ONLY.
-- Schema installation only: no expense edit/conversion, account entry or Reset.
-- Keep existing33 migrations and all financial facts. Never reset a shared database.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('tabby.trip-editor.install',0));
do $tabby_trip_editor_install$
declare migration_sql text;
begin
 if(select array_agg(version order by version)from supabase_migrations.schema_migrations where version<>'{version}')is distinct from array[{expected}]::text[]then raise exception 'Unexpected Tabby migration baseline';end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='{version}')then
  migration_sql:=convert_from(decode($tabby_payload$
{payload}
$tabby_payload$,'base64'),'UTF8');
  if encode(extensions.digest(migration_sql,'sha256'),'hex')<>'{digest}'then raise exception 'Incomplete Issue07 payload';end if;
  execute migration_sql;
  insert into supabase_migrations.schema_migrations(version,name,statements)values('{version}','unified_trip_expense_editor',array[migration_sql]);
 end if;
{chr(10).join(checks)}
 if has_table_privilege('authenticated','public.expense_editor_settings','UPDATE')or has_function_privilege('anon','public.get_trip_expense_editor(uuid)','EXECUTE')or has_function_privilege('authenticated','private.link_personal_trip_expense(uuid,uuid,uuid)','EXECUTE')then raise exception 'Unexpected Issue07 privileges';end if;
 if not(select relrowsecurity from pg_class where oid='public.expense_editor_settings'::regclass)then raise exception 'Missing editor RLS';end if;
end;
$tabby_trip_editor_install$;
notify pgrst,'reload schema';
commit;
select 'TABBY_TRIP_EDITOR_INSTALL_COMPLETE_20261031' as installation_status;
'''
(root / 'docs/runbooks/trip-editor-production-apply.sql').write_text(text)
print('Generated Issue07 guarded installer; canonical SHA256 ' + digest)
