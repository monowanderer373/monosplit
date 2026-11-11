"""Read-only schema/ACL audit. Never runs a payment or installation.

--production uses the existing project's secure SUPABASE_ACCESS_TOKEN binding.
--db-url accepts only a disposable loopback PostgreSQL database for testing.
"""
from pathlib import Path
import argparse,json,os,re,subprocess,sys,urllib.request
from urllib.parse import urlsplit
root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
group=parser.add_mutually_exclusive_group(required=True)
group.add_argument('--production',action='store_true')
group.add_argument('--db-url')
args=parser.parse_args()
installer=(root/'docs/runbooks/trip-creator-production-apply.sql').read_text()
functions=dict(re.findall(r"to_regprocedure\('([^']+)'\)\)is distinct from '([0-9a-f]{32})'",installer))
assert len(functions)==47
quote=lambda x:"'"+x.replace("'","''")+"'"
versions=sorted(p.name.split('_')[0]for p in(root/'supabase/migrations').glob('*.sql'))
values=','.join('('+quote(sig)+','+quote(digest)+')'for sig,digest in functions.items())
tables=['public.trip_settlement_batches','public.settlement_fx_bundles','public.settlement_fx_coverages','public.settlement_payments','public.personal_account_entries','private.trip_routed_proposals','private.trip_routed_approvals','private.trip_routed_receipts',*['private.'+t for t in ['creator_policies','creator_grants','creator_reviews','creator_records','creator_receipts','creator_corrections','creator_audit','creator_outbox']],'public.creator_settlement_notices']
private=['private.trip_batch_cash','private.trip_batch_quotes',*[t for t in tables if t.startswith('private.')]]
query=f"""with expected(sig,body)as(values {values}),audited as(
 select e.sig,p.oid is not null and md5(replace(p.prosrc,chr(13)||chr(10),chr(10)))=e.body body_ok,
 coalesce(not has_function_privilege('anon',p.oid,'EXECUTE')and has_function_privilege('authenticated',p.oid,'EXECUTE')=(e.sig like 'public.%'),false)acl_ok
 from expected e left join pg_proc p on p.oid=to_regprocedure(e.sig)
)select jsonb_build_object('role',current_user,'readOnly',current_setting('transaction_read_only'),'canCreate',has_schema_privilege(current_user,'public','CREATE'),
 'versionsMatch',(select array_agg(version order by version)from supabase_migrations.schema_migrations)=array[{','.join(map(quote,versions))}]::text[],
 'expectedFunctions',47,'matchingBodies',(select count(*)from audited where body_ok),'matchingFunctionAcls',(select count(*)from audited where acl_ok),
 'missingOrChangedFunctions',(select coalesce(jsonb_agg(sig),'[]')from audited where not body_ok or not acl_ok),
 'financialRls',not exists(select 1 from unnest(array[{','.join(map(quote,tables))}])t(name)left join pg_class c on c.oid=to_regclass(t.name)where c.oid is null or not c.relrowsecurity),
 'privateTablesProtected',not exists(select 1 from unnest(array[{','.join(map(quote,private))}])t(name)where to_regclass(t.name)is null or coalesce(has_table_privilege('authenticated',to_regclass(t.name),'SELECT,INSERT,UPDATE,DELETE'),true)or coalesce(has_table_privilege('anon',to_regclass(t.name),'SELECT,INSERT,UPDATE,DELETE'),true)),
 'noticeAcls',not has_table_privilege('anon','public.creator_settlement_notices','SELECT,INSERT,UPDATE,DELETE')and not has_table_privilege('authenticated','public.creator_settlement_notices','INSERT,UPDATE,DELETE')and has_table_privilege('authenticated','public.creator_settlement_notices','SELECT'),
 'noticePolicy',exists(select 1 from pg_policies where schemaname='public'and tablename='creator_settlement_notices'and policyname='creator_notice_recipient'),
 'workerScheduled',exists(select 1 from cron.job where jobname='tabby-creator-notices'and active and command='select private.deliver_creator_notices(null,100);'),
 'realtimeAttached',not exists(select 1 from pg_publication where pubname='supabase_realtime')or exists(select 1 from pg_publication_tables where pubname='supabase_realtime'and schemaname='public'and tablename='creator_settlement_notices'),
 'financialWrites',0)as audit;"""
try:
 if args.production:
  token=os.environ['SUPABASE_ACCESS_TOKEN']
  req=urllib.request.Request('https://api.supabase.com/v1/projects/skiqsxvmxvmxfzhrzcxh/database/query',data=json.dumps({'query':query}).encode(),headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'},method='POST')
  with urllib.request.urlopen(req,timeout=30)as response:audit=json.load(response)[0]['audit']
 else:
  u=urlsplit(args.db_url)
  assert u.hostname in('127.0.0.1','localhost','::1')and((u.port==54322 and u.path=='/postgres')or(u.port==55439 and u.path in('/tabby_routed_isolated','/tabby_creator_upgrade'))),'Disposable loopback database required'
  result=subprocess.run(['psql','-X','-qAt','-v','ON_ERROR_STOP=1',args.db_url],input=query,text=True,capture_output=True,check=True,timeout=30)
  audit=json.loads(result.stdout)
except Exception as error:
 print('Schema audit unavailable: '+type(error).__name__,file=sys.stderr);sys.exit(2)
print(json.dumps(audit,indent=2))
sys.exit(0 if audit['versionsMatch']and audit['matchingBodies']==47 and audit['matchingFunctionAcls']==47 and audit['financialRls']and audit['privateTablesProtected']and audit['noticeAcls']and audit['noticePolicy']and audit['workerScheduled']and audit['realtimeAttached']else 1)
