"""Generate the reviewed SQL Editor installer from exact canonical migration bytes."""
from pathlib import Path
import re,hashlib,base64,textwrap
root=Path(__file__).resolve().parents[1]
path=root/'supabase/migrations/202611050001_trip_batch_mixed_settlement.sql'
raw=path.read_bytes();sql=raw.decode();sha=hashlib.sha256(raw).hexdigest()
versions=sorted(p.name.split('_')[0]for p in(root/'supabase/migrations').glob('*.sql')if p!=path)
functions=[]
for match in re.finditer(r'create(?: or replace)? function ([\w.]+)\((.*?)\)\s*returns.*?\bas \$\$(.*?)\$\$;',sql,re.S|re.I):
 name,args,body=match.groups();types=','.join(re.split(r'\s+',a.strip())[1]for a in args.split(','));functions.append((name+'('+types+')',hashlib.md5(body.encode()).hexdigest()))
assert len(functions)==12,len(functions)
check=lambda signature,digest: f" if(select md5(replace(prosrc,chr(13)||chr(10),chr(10)))from pg_proc where oid=to_regprocedure('{signature}'))is distinct from '{digest}'then raise exception 'Unexpected function: {signature}';end if;\n"
previous=[('public.propose_fx_settlement_bundle(uuid,uuid,uuid,text,text,jsonb,bigint,uuid)','7f89fc778418a465f223f817934099e7'),('public.respond_fx_settlement_bundle(uuid,text,integer,uuid)','75c822e78689d335b7ba250d9438c514'),('public.cancel_fx_settlement_bundle(uuid,integer)','9770306dd33df392160ee4cc6229978a'),('public.reverse_fx_settlement_bundle(uuid,uuid,integer)','987f1096706963d8a08e32e7c26b910e')]
output=f"""-- COMPLETE FILE: existing Tabby Tally / skiqsxvmxvmxfzhrzcxh only.
-- Installs batch capability. Does NOT register payments, edit expenses, clear debt or post money.
-- Canonical migration SHA256: {sha}
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('tabby.trip.batch.install',0));
do $tabby_trip_batch_install$
declare migration_sql text;
begin
 if(select array_agg(version order by version)from supabase_migrations.schema_migrations where version<>'202611050001')is distinct from array[{','.join(repr(v)for v in versions)}]::text[]then raise exception 'Unexpected Tabby migration baseline';end if;
 if not exists(select 1 from supabase_migrations.schema_migrations where version='202611050001')then
{''.join(check(*f)for f in previous)}  migration_sql:=convert_from(decode($tabby_payload$
{textwrap.fill(base64.b64encode(raw).decode(),100)}
$tabby_payload$,'base64'),'UTF8');
  if encode(extensions.digest(migration_sql,'sha256'),'hex')<>'{sha}'then raise exception 'Incomplete trip batch payload';end if;
  execute replace(regexp_replace(migration_sql,'commit;\\s*$','','i'),E'begin;\\n','');
  insert into supabase_migrations.schema_migrations(version,name,statements)values('202611050001','trip_batch_mixed_settlement',array[migration_sql]);
 end if;
{''.join(check(*f)for f in functions)} if has_function_privilege('anon','public.submit_trip_settlement_batch(uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','private.respond_fx_bundle(uuid,text,integer,jsonb,boolean)','EXECUTE')or has_table_privilege('authenticated','private.trip_batch_cash','SELECT')or has_table_privilege('authenticated','private.trip_batch_quotes','SELECT')then raise exception 'Unexpected batch privileges';end if;
 if exists(select 1 from pg_class where oid in('public.trip_settlement_batches'::regclass,'public.settlement_fx_bundles'::regclass,'public.settlement_fx_coverages'::regclass,'public.settlement_payments'::regclass,'public.personal_account_entries'::regclass)and not relrowsecurity)then raise exception 'Missing financial RLS';end if;
end;
$tabby_trip_batch_install$;
notify pgrst,'reload schema';
commit;
select 'TABBY_TRIP_BATCH_INSTALL_COMPLETE_20261105' as installation_status;
"""
(root/'docs/runbooks/trip-batch-production-apply.sql').write_text(output)
print('Generated canonical batch installer:',len(output.encode()),'bytes;',len(functions),'function fingerprints')
