"""Generate one atomic, rerunnable existing-project schema install. No financial reset."""
from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]
name='202610250001_personal_ledger_periods.sql'
version,label=name.removesuffix('.sql').split('_',1)
prior=sorted(p.name.split('_')[0]for p in(root/'supabase/migrations').glob('*.sql')if p.name.split('_')[0]<version)
assert len(prior)==28 and prior[-1]=='20261016132156','Review the actual existing baseline before generating.'
sql=(root/'supabase/migrations'/name).read_text()
delimiter='$tabby_personal_periods_ddl$'
assert delimiter not in sql
expected=','.join("'"+v+"'"for v in prior)
output=f"""-- COMPLETE FILE: existing Tabby Tally / Supabase skiqsxvmxvmxfzhrzcxh only.
-- Installs schema capability. DOES NOT execute a Fresh Start or reset any account.
-- No financial records are deleted, replayed, zeroed or modified by this install.
-- Source {name} SHA256 {hashlib.sha256(sql.encode()).hexdigest()}
-- Run the entire downloaded file in the existing project's SQL Editor.
begin;
set local lock_timeout='10s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tabby.personal-periods.migration',0));
do $tabby_personal_periods_apply$
declare migration_sql text;
begin
 if(select pg_catalog.array_agg(version order by version)from supabase_migrations.schema_migrations where version<>'{version}')
 is distinct from array[{expected}]::text[] then
  raise exception 'Unexpected Tabby migration history. Stop and verify the existing project.';end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='{version}')then
  migration_sql:={delimiter}{sql}{delimiter};
  execute migration_sql;
  insert into supabase_migrations.schema_migrations(version,name,statements)values('{version}','{label}',array[migration_sql]);
 end if;
 if pg_catalog.to_regprocedure('public.get_personal_ledger_period_state()')is null
 or pg_catalog.to_regprocedure('public.apply_personal_fresh_start(uuid,uuid,jsonb)')is null
 or pg_catalog.to_regprocedure('public.reconcile_personal_fresh_start(uuid)')is null
 or pg_catalog.to_regprocedure('public.get_personal_ledger_archive(uuid)')is null
 or(select count(*)from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relname in('personal_ledger_periods','personal_period_expenses','personal_period_transactions','personal_period_openings','personal_fresh_start_previews','personal_fresh_start_operations')and c.relrowsecurity)<>6 then
  raise exception 'Personal period safeguards are incomplete.';end if;
end $tabby_personal_periods_apply$;
notify pgrst,'reload schema';
commit;
select 'TABBY_PERSONAL_PERIODS_INSTALL_COMPLETE_20261025' as result;
-- END OF COMPLETE FILE — TABBY_PERSONAL_PERIODS_INSTALL_COMPLETE_20261025
"""
path=root/'docs/runbooks/personal-periods-production-apply.sql'
path.write_text(output)
print(f'Generated {path.relative_to(root)} ({path.stat().st_size} bytes); schema only, no Reset executed.')
