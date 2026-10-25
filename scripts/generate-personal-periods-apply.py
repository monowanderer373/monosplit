"""One atomic, rerunnable existing-project capability+opening-safety install."""
from pathlib import Path
import hashlib
root=Path(__file__).resolve().parents[1]
names=('202610250001_personal_ledger_periods.sql','202610250002_personal_period_opening_safety.sql')
versions=[name.split('_')[0]for name in names]
prior=sorted(p.name.split('_')[0]for p in(root/'supabase/migrations').glob('*.sql')if p.name.split('_')[0]<versions[0])
assert len(prior)==28 and prior[-1]=='20261016132156','Review actual baseline.'
expected=','.join("'"+v+"'"for v in prior);new=','.join("'"+v+"'"for v in versions)
parts=[f"""-- COMPLETE FILE V2: existing Tabby Tally / Supabase skiqsxvmxvmxfzhrzcxh only.
-- Installs capability AND linked-obligation opening guards.
-- This does NOT execute Fresh Start, reset balances or modify financial facts.
-- Original001 is preserved. An already installed001 is skipped safely.
begin;
set local lock_timeout='10s';
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tabby.personal-periods.migration',0));
do $tabby_personal_periods_apply$
declare migration_sql text;
begin
 if(select pg_catalog.array_agg(version order by version)from supabase_migrations.schema_migrations where version not in({new}))
 is distinct from array[{expected}]::text[] then
  raise exception 'Unexpected Tabby migration history. Stop and verify existing project.';end if;
 if exists(select 1 from supabase_migrations.schema_migrations where version='{versions[1]}')and not exists(select 1 from supabase_migrations.schema_migrations where version='{versions[0]}')then
  raise exception 'Incomplete personal-period migration history.';end if;
"""]
for index,name in enumerate(names):
 sql=(root/'supabase/migrations'/name).read_text()
 version,label=name.removesuffix('.sql').split('_',1)
 delimiter=f'$tabby_personal_periods_ddl_{index}$';assert delimiter not in sql
 parts.append(f"""
 -- {name} SHA256 {hashlib.sha256(sql.encode()).hexdigest()}
 if not exists(select 1 from supabase_migrations.schema_migrations where version='{version}')then
  migration_sql:={delimiter}{sql}{delimiter};
  execute migration_sql;
  insert into supabase_migrations.schema_migrations(version,name,statements)values('{version}','{label}',array[migration_sql]);
 end if;
""")
parts.append("""
 if pg_catalog.to_regprocedure('public.get_personal_ledger_period_state()')is null
 or pg_catalog.to_regprocedure('public.apply_personal_fresh_start(uuid,uuid,jsonb)')is null
 or pg_catalog.to_regprocedure('public.reconcile_personal_fresh_start(uuid)')is null
 or pg_catalog.to_regprocedure('public.get_personal_ledger_archive(uuid)')is null
 or pg_catalog.to_regprocedure('private.personal_period_opening_locks(uuid)')is null
 or(select count(*)from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'and c.relname in('personal_ledger_periods','personal_period_expenses','personal_period_transactions','personal_period_openings','personal_fresh_start_previews','personal_fresh_start_operations')and c.relrowsecurity)<>6 then
  raise exception 'Personal period safeguards are incomplete.';end if;
end $tabby_personal_periods_apply$;
notify pgrst,'reload schema';
commit;
select 'TABBY_PERSONAL_PERIODS_INSTALL_COMPLETE_20261025_V2' as result;
-- END OF COMPLETE FILE — TABBY_PERSONAL_PERIODS_INSTALL_COMPLETE_20261025_V2
""")
path=root/'docs/runbooks/personal-periods-production-apply.sql';path.write_text(''.join(parts))
print(f'Generated {path.relative_to(root)} ({path.stat().st_size} bytes), V2 schema-only.')
