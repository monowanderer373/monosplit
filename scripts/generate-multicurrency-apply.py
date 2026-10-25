"""Generate the complete transactional SQL Editor bundle; no environment or credentials."""
from pathlib import Path
import hashlib

ROOT = Path(__file__).resolve().parents[1]
NAMES = ('20261016130602_multicurrency_accounts_and_funding.sql', '20261016132156_multicurrency_money_movements.sql')
versions = sorted(p.name.split('_')[0] for p in (ROOT / 'supabase/migrations').glob('*.sql') if p.name not in NAMES and p.name.split('_')[0] <= '202610130002')
assert len(versions) == 26 and versions[-1] == '202610130002', 'Review the actual baseline before regenerating.'
base = ','.join("'" + v + "'" for v in versions)
new = ','.join("'" + name.split('_')[0] + "'" for name in NAMES)
parts = [f"""-- COMPLETE FILE: existing Tabby Tally only; Supabase project skiqsxvmxvmxfzhrzcxh.
-- Generated from the two forward migrations; never copy a truncated preview.
-- Does not reset, replay, update or delete existing financial facts.
-- One transaction: failure rolls everything back; a successful rerun is a no-op.
begin;
set local lock_timeout='10s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tabby.multicurrency.migration',0));
do $tabby_mc_apply$
declare migration_sql text;
begin
 if (select pg_catalog.array_agg(version order by version) from supabase_migrations.schema_migrations where version not in ({new}))
   is distinct from array[{base}]::text[] then raise exception 'Unexpected Tabby migration history. Stop and recheck the project.'; end if;
 if exists(select 1 from supabase_migrations.schema_migrations where version='{NAMES[1].split('_')[0]}')
  and not exists(select 1 from supabase_migrations.schema_migrations where version='{NAMES[0].split('_')[0]}')
  then raise exception 'Incomplete multicurrency migration history. Stop and inspect.'; end if;
"""]
for index, name in enumerate(NAMES):
    sql = (ROOT / 'supabase/migrations' / name).read_text()
    delimiter = f'$tabby_mc_ddl_{index}$'
    assert delimiter not in sql
    version, label = name.removesuffix('.sql').split('_', 1)
    parts.append(f"""
 -- {name} SHA256 {hashlib.sha256(sql.encode()).hexdigest()}
 if not exists(select 1 from supabase_migrations.schema_migrations where version='{version}') then
  migration_sql:={delimiter}{sql}{delimiter};
  execute migration_sql;
  insert into supabase_migrations.schema_migrations(version,name,statements) values('{version}','{label}',array[migration_sql]);
 end if;
""")
parts.append("""
 if pg_catalog.to_regprocedure('public.get_personal_multicurrency_accounts()') is null
 or pg_catalog.to_regprocedure('public.reconcile_personal_money_operation(uuid)') is null
 or pg_catalog.to_regprocedure('public.confirm_personal_funding_bundle(uuid,uuid,integer,integer,jsonb,boolean)') is null
 or pg_catalog.to_regprocedure('public.record_personal_money_movement(uuid,jsonb)') is null
 or pg_catalog.to_regclass('public.personal_account_currencies') is null
 then raise exception 'Multicurrency installation is incomplete.'; end if;
end $tabby_mc_apply$;
notify pgrst,'reload schema';
commit;
select 'TABBY_MULTICURRENCY_APPLY_COMPLETE_20261016' as result;
-- END OF COMPLETE FILE — TABBY_MULTICURRENCY_APPLY_COMPLETE_20261016
""")
output = ROOT / 'docs/runbooks/multicurrency-production-apply.sql'
output.write_text(''.join(parts))
print(f'Generated {output.relative_to(ROOT)} ({output.stat().st_size} bytes).')
