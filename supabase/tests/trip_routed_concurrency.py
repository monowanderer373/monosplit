"""Real PostgreSQL sessions; only the disposable CI DB or the named local test DB."""
import json,os,subprocess,time,uuid
from urllib.parse import urlsplit
url=os.environ.get('ROUTED_SETTLEMENT_TEST_DB_URL','');u=urlsplit(url)
assert u.hostname in('127.0.0.1','localhost','::1')and((u.port==54322 and u.path=='/postgres')or(u.port==55439 and u.path=='/tabby_routed_isolated')),'Explicit disposable loopback DB required'
cmd=['psql','-X','-qAt','-v','ON_ERROR_STOP=1',url]
def q(x):return "'"+str(x).replace("'","''")+"'"
def run(sql,error=None):
 r=subprocess.run(cmd,input=sql,text=True,capture_output=True,timeout=20)
 if error:assert r.returncode and any(e in r.stderr for e in error.split('|')),'Expected isolated rejection missing; private rows withheld'
 else:assert not r.returncode,'Isolated routed query failed: '+r.stderr[-1200:]
 return r.stdout.strip().splitlines()
def auth(x):return 'set role authenticated;set request.jwt.claims='+q(json.dumps({'sub':x,'role':'authenticated','is_anonymous':False}))+';'
def scalar(sql):return run(sql)[-1]
def js(sql):return json.loads(scalar(sql))
processes=[]
def hold(sql):
 p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);processes.append(p);p.stdin.write("begin;set local statement_timeout='15000ms';"+sql+"select 'routed-lock-ready';\n");p.stdin.flush()
 for line in p.stdout:
  if line.strip()=='routed-lock-ready':return p
 raise AssertionError('Isolated holder failed before readiness')
def commit(p):
 out,err=p.communicate('commit;\n',timeout=20);assert not p.returncode,err[-1000:]
def fixture():
 users=[str(uuid.uuid4())for _ in range(3)]
 for x in users:run("insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('00000000-0000-0000-0000-000000000000',"+q(x)+",'authenticated','authenticated',"+q('routed-'+x+'@example.test')+",'',now(),'{\"provider\":\"email\"}','{\"display_name\":\"Isolated routed\"}',now(),now());")
 ids=[scalar(auth(x)+'select current_participant_id();')for x in users];trip=scalar(auth(users[0])+"select create_space('trip','Routed race',null,null,'MYR');")
 run('insert into space_members(space_id,participant_id,role)values('+q(trip)+','+q(ids[1])+",'view'),("+q(trip)+','+q(ids[2])+",'view');")
 for debtor,creditor in[(ids[0],ids[1]),(ids[1],ids[2])]:
  payload={'expense_scope':'space','target_space_id':trip,'participant_ids':[creditor,debtor],'contribution_amounts':[10000,0],'share_amounts':[0,10000],'total_minor':10000,'currency_code':'MYR','description':'Routed race','category':'Food','occurred_on':'2026-11-10'}
  run(auth(users[0])+'select create_trip_expense_editor('+q(uuid.uuid4())+','+q(trip)+','+q(json.dumps(payload))+'::jsonb,array['+q(creditor)+','+q(debtor)+']::uuid[]);')
 accounts=[js(auth(x)+'select create_personal_account('+q(uuid.uuid4())+",'Routed race cash','cash','MYR',null,null,false);")['account_id']for x in users]
 draft={'rateMode':'custom','vndPerMyr':'6000','payments':[{'id':'actual','payer':ids[0],'recipient':ids[2],'tenderCurrency':'MYR','tenderMinor':10000,'method':'bank_transfer','via':{'person':ids[1],'minor':600000}}]}
 return users,ids,trip,accounts,draft
def prepared(f,request=None):
 users,ids,trip,accounts,draft=f;review=js(auth(users[0])+'select preview_trip_routed_settlement('+q(trip)+','+q(json.dumps(draft))+'::jsonb);')
 request=request or str(uuid.uuid4());sql='select submit_trip_routed_settlement('+q(trip)+','+q(json.dumps(draft))+'::jsonb,'+q(request)+','+q(review['digest'])+','+q(review['expiresAt'])+');'
 return review,request,sql
def early(f):
 users,ids,trip,accounts,draft=f;_,_,sql=prepared(f);p=js(auth(users[0])+sql)['id']
 run(auth(users[0])+'select decide_trip_routed_settlement('+q(p)+",'approve',1,"+q(json.dumps({'actual:payer':accounts[0]}))+'::jsonb);')
 run(auth(users[2])+'select decide_trip_routed_settlement('+q(p)+",'approve',2,"+q(json.dumps({'actual:receiver':accounts[2]}))+'::jsonb);')
 return p
def last(p):return 'select decide_trip_routed_settlement('+q(p)+",'approve',3,'{}');"
try:
 f=fixture();users,ids,trip,accounts,draft=f;a,b=early(f),early(f)
 recipients=[{'participantId':ids[1],'cash':[{'currency':'MYR','amountMinor':'10000','accountId':accounts[0]}]}]
 batch=js(auth(users[0])+'select quote_trip_settlement_batch('+q(trip)+",'custom','6000',null,"+q(json.dumps(recipients))+'::jsonb);')['quoteId']
 first=hold(auth(users[1])+last(a))
 run(auth(users[1])+last(b),'balance_changed')
 run(auth(users[0])+'select propose_fx_settlement_bundle('+q(uuid.uuid4())+','+q(trip)+','+q(ids[1])+",'MYR','custom','{}',10000,"+q(accounts[0])+');','balance_changed')
 run(auth(users[0])+'select submit_trip_settlement_batch('+q(batch)+','+q(uuid.uuid4())+');','balance_changed')
 commit(first)
 assert js(auth(users[1])+last(b))['status']=='stale'
 run(auth(users[0])+'select submit_trip_settlement_batch('+q(batch)+','+q(uuid.uuid4())+');','no_outstanding_debt|not_net_payer')
 assert scalar('select count(*)from private.trip_routed_receipts where proposal='+q(a)+" and kind='cash';")=='1'
 assert scalar('select count(*)from private.trip_routed_receipts where proposal='+q(b)+';')=='0'
 assert scalar('select sum(amount_minor)from personal_account_entries where account_id='+q(accounts[0])+';')=='-10000'
 print('PASS: overlapping routed/routed, legacy FX/routed and batch/routed; one native cash posting; stale competitor has no receipts')
 # Reverse competition: original FX confirmation wins first, routed can no longer post.
 f2=fixture();us,ps,tr,ac,dr=f2;p=early(f2)
 fx=js(auth(us[0])+'select propose_fx_settlement_bundle('+q(uuid.uuid4())+','+q(tr)+','+q(ps[1])+",'MYR','custom','{}',10000,"+q(ac[0])+');')['bundle_id']
 first=hold(auth(us[1])+'select respond_fx_settlement_bundle('+q(fx)+",'accepted',1,"+q(ac[1])+');')
 run(auth(us[1])+last(p),'balance_changed');commit(first)
 assert js(auth(us[1])+last(p))['status']=='stale'
 assert scalar('select count(*)from private.trip_routed_receipts where proposal='+q(p)+';')=='0'
 print('PASS: legacy confirmation wins reverse ordering; routed final approval becomes stale without cash or native coverage')
 # Same request is serialized by existing actor/request receipts across real sessions.
 f3=fixture();us,ps,tr,ac,dr=f3;review,request,sql=prepared(f3);first=hold(auth(us[0])+sql)
 app='routed-request-'+str(uuid.uuid4());second=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);processes.append(second)
 second.stdin.write('set application_name='+q(app)+";set statement_timeout='15000ms';"+auth(us[0])+sql+'\n');second.stdin.flush()
 for _ in range(100):
  if scalar('select count(*)from pg_stat_activity where application_name='+q(app)+" and wait_event_type='Lock';")=='1':break
  time.sleep(.05)
 else:raise AssertionError('Same request did not overlap a real lock wait')
 commit(first);out,err=second.communicate('',timeout=20);assert not second.returncode,err[-800:]
 same=js(auth(us[0])+sql);assert scalar('select count(*)from private.trip_routed_proposals where author='+q(ps[0])+' and request_id='+q(request)+';')=='1'
 other=dict(dr,vndPerMyr='6001');run(auth(us[0])+'select submit_trip_routed_settlement('+q(tr)+','+q(json.dumps(other))+'::jsonb,'+q(request)+','+q(review['digest'])+','+q(review['expiresAt'])+');','idempotency_conflict')
 assert js(auth(us[0])+'select reconcile_personal_money_operation('+q(request)+');')['result']['proposalId']==same['id']
 _,retired,late=prepared(f3);assert js(auth(us[0])+'select reconcile_personal_money_operation('+q(retired)+');')['state']=='not_posted';run(auth(us[0])+late,'idempotency_conflict')
 print('PASS: same-request concurrent replay, payload conflict, committed recovery and retired late-request fence')
finally:
 for p in processes:
  if p.poll()is None:p.kill();p.communicate()
