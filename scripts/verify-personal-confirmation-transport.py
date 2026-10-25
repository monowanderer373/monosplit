"""Installer transport regression. DB checks are restricted to disposable loopback54322."""
from pathlib import Path
import argparse,base64,hashlib,os,re,subprocess,textwrap
from urllib.parse import urlparse
root=Path(__file__).resolve().parents[1]
script=(root/'docs/runbooks/personal-confirmation-production-apply.sql').read_text()
migration=(root/'supabase/migrations/202610250003_personal_period_session_confirmation.sql').read_bytes()
pattern=r'(\$tabby_session_confirmation_payload\$)(.*?)(\$tabby_session_confirmation_payload\$)'
match=re.search(pattern,script,re.S)
assert match,'canonical payload missing'
encoded=''.join(match[2].split())
wrapped=script[:match.start(2)]+'\n'+textwrap.fill(encoded,37,initial_indent='\t ',subsequent_indent='\t ')+'\n'+script[match.end(2):]
variants={'lf':script,'crlf':script.replace('\n','\r\n'),'indented':'\n'.join('  '+line for line in script.split('\n')),'wrapped':wrapped}
for name,value in variants.items():
 payload=re.search(pattern,value,re.S)[2]
 assert base64.b64decode(''.join(payload.split()),validate=True)==migration,name
 assert hashlib.sha256(migration).hexdigest()in value
parser=argparse.ArgumentParser();parser.add_argument('--check-only',action='store_true')
if parser.parse_args().check_only:
 print('PASS: four transport variants decode to the exact canonical migration bytes');raise SystemExit(0)
url=os.environ.get('LOCAL_DATABASE_URL','');parsed=urlparse(url)
if parsed.scheme not in ['postgres','postgresql']or parsed.hostname not in ['127.0.0.1','localhost']or parsed.port!=54322:
 raise SystemExit('Refusing transport DDL checks outside disposable loopback54322')
def run(sql,label,expected_error=None):
 result=subprocess.run(['psql',url,'-X','-v','ON_ERROR_STOP=1','-At'],input=sql,text=True,capture_output=True)
 if expected_error:
  assert result.returncode!=0 and expected_error in result.stderr,label+': expected rejection missing'
 else:
  if result.returncode:raise RuntimeError(label+': '+result.stderr[-900:])
 return result.stdout
fingerprint="""select concat_ws('|',(select count(*)from supabase_migrations.schema_migrations),
 (select md5(prosrc)from pg_proc where oid='public.apply_personal_fresh_start(uuid,uuid,jsonb)'::regprocedure),
 (select md5(prosrc)from pg_proc where oid='public.get_personal_ledger_period_state()'::regprocedure),
 (select count(*)from public.personal_ledger_periods),(select count(*)from public.personal_period_openings));"""
baseline=run(fingerprint,'read baseline');assert baseline.startswith('30|'),'requires the installed001+002baseline before003'
# Reproduce the former raw-DDL transport bug with a whole-selection editor indent.
start=script.index('  migration_sql:=pg_catalog.convert_from(');end=script.index('  execute migration_sql;',start)
raw_form=script[:start]+'  migration_sql:=$legacy_raw_ddl$'+migration.decode('utf-8')+'$legacy_raw_ddl$;\n'+script[end:]
indented_raw='\n'.join('  '+line for line in raw_form.split('\n'))
run(indented_raw,'former raw literal after editor indent','Unexpected session-confirmation function body')
assert run(fingerprint,'read after former failure')==baseline
for name,value in variants.items():
 value,count=re.subn(r'(?m)^[ \t]*commit;\r?$', 'rollback;',value);assert count==1,name
 run(value,name)
 assert run(fingerprint,'read '+name)==baseline,name+': disposable probe did not roll back'
# Reject corruption before executing DDL, with the original002 definitions intact.
bad=base64.b64encode(b'-- changed payload must not install\n'+migration).decode('ascii')
tampered=script[:match.start(2)]+'\n'+bad+'\n'+script[match.end(2):]
run(tampered,'tampered payload','Session confirmation migration payload checksum mismatch.')
assert run(fingerprint,'read after rejection')==baseline
print('PASS: reproduced former raw-literal checksum failure; LF/CRLF/indent/wrapped installers preserve exact function bodies; four rollback probes and tamper rejection preserve002/history')
