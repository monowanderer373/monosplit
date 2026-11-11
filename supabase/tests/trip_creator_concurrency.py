"""Real PostgreSQL sessions; only the disposable CI DB or the named local test DB."""
import json,os,subprocess,time,uuid
from urllib.parse import urlsplit
url=os.environ.get('CREATOR_SETTLEMENT_TEST_DB_URL','');u=urlsplit(url)
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
 p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);processes.append(p);p.stdin.write("begin;set local statement_timeout='15000ms';"+sql+"select 'creator-lock-ready';\n");p.stdin.flush()
 for line in p.stdout:
  if line.strip()=='creator-lock-ready':return p
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
 users,ids,trip,accounts,draft=f
 from datetime import datetime,timezone
 draft=dict(draft,occurredAt=datetime.now(timezone.utc).isoformat(),note='',ownAccountLinks=[])
 review=js(auth(users[0])+'select preview_trip_creator_settlement('+q(trip)+','+q(json.dumps(draft))+'::jsonb);')
 assert review['digest']
 request=request or str(uuid.uuid4());sql='select record_trip_creator_settlement('+q(trip)+','+q(json.dumps(draft))+'::jsonb,'+q(request)+','+q(review['digest'])+','+q(review['expiresAt'])+',true);'
 return review,request,sql
try:
 f=fixture();users,ids,trip,accounts,draft=f
 context=js(auth(users[0])+'select get_trip_creator_context('+q(trip)+');')
 run(auth(users[0])+'select set_trip_creator_delegate('+q(trip)+','+q(ids[1])+',true,'+q(uuid.uuid4())+','+q(context['policyVersion'])+');')
 review,request,sql=prepared(f)
 delegate_f=([users[1],*users[1:]],ids,trip,accounts,draft);_,_,other_sql=prepared(delegate_f)
 recipients=[{'participantId':ids[2],'cash':[{'currency':'MYR','amountMinor':'10000','accountId':accounts[1]}]}]
 batch=js(auth(users[1])+'select quote_trip_settlement_batch('+q(trip)+",'custom','6000',null,"+q(json.dumps(recipients))+'::jsonb);')['quoteId']
 first=hold(auth(users[0])+sql)
 run(auth(users[1])+'select submit_trip_settlement_batch('+q(batch)+','+q(uuid.uuid4())+');','balance_changed')
 # The common financial lock rejects a distinct competing proxy/legacy/batch operation without a partial receipt.
 run(auth(users[1])+other_sql,'balance_changed')
 run(auth(users[1])+'select propose_fx_settlement_bundle('+q(uuid.uuid4())+','+q(trip)+','+q(ids[2])+",'MYR','custom','{}',10000,"+q(accounts[1])+');','balance_changed')
 commit(first)
 run(auth(users[1])+other_sql,'invalid_routed_plan|quote_changed')
 assert scalar('select count(*)from private.creator_records where space_id='+q(trip)+';')=='1'
 assert scalar('select count(*)from private.creator_receipts r join private.creator_records c on c.id=r.record_id where c.space_id='+q(trip)+" and r.kind='cash';")=='1'
 print('PASS: creator/creator and legacy/creator overlap; one cash fact, stale competitor rejected')
 f=fixture();users,ids,trip,accounts,draft=f;review,request,sql=prepared(f)
 first=hold(auth(users[0])+sql);app='creator-replay-'+str(uuid.uuid4());second=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);processes.append(second)
 second.stdin.write('set application_name='+q(app)+";set statement_timeout='15000ms';"+auth(users[0])+sql+'\n');second.stdin.flush()
 for _ in range(100):
  if scalar('select count(*)from pg_stat_activity where application_name='+q(app)+" and wait_event_type='Lock';")=='1':break
  time.sleep(.05)
 else:raise AssertionError('Same-ID requests did not actually overlap')
 commit(first);out,err=second.communicate('',timeout=20);assert not second.returncode,err[-800:]
 assert scalar('select count(*)from private.creator_records where space_id='+q(trip)+';')=='1'
 assert js(auth(users[0])+sql)['status']=='posted'
 assert scalar('select count(*)from private.creator_outbox o join private.creator_records r on r.id=o.record_id where r.space_id='+q(trip)+';')=='2'
 print('PASS: real concurrent same-ID retry returns the single committed record and one outbox event per affected peer')
 # Explicit revocation takes effect even for a precomputed delegate preview.
 f=fixture();users,ids,trip,accounts,draft=f
 context=js(auth(users[0])+'select get_trip_creator_context('+q(trip)+');')
 run(auth(users[0])+'select set_trip_creator_delegate('+q(trip)+','+q(ids[1])+',true,'+q(uuid.uuid4())+','+q(context['policyVersion'])+');')
 delegate=( [users[1],*users[1:]],ids,trip,accounts,draft )
 _,_,delegated_sql=prepared(delegate)
 context=js(auth(users[0])+'select get_trip_creator_context('+q(trip)+');')
 first=hold(auth(users[0])+'select set_trip_creator_delegate('+q(trip)+','+q(ids[1])+',false,'+q(uuid.uuid4())+','+q(context['policyVersion'])+');')
 run(auth(users[1])+delegated_sql,'balance_changed');commit(first)
 run(auth(users[1])+delegated_sql,'creator_proxy_forbidden')
 assert scalar('select count(*)from private.creator_records where space_id='+q(trip)+';')=='0'
 print('PASS: actual-session revoke/submit race and current authorization after revoke')
 # Original routed final approval and creator direct recording compete on the same native sources.
 f=fixture();users,ids,trip,accounts,draft=f;_,_,creator_sql=prepared(f)
 review=js(auth(users[0])+'select preview_trip_routed_settlement('+q(trip)+','+q(json.dumps(draft))+'::jsonb);')
 prop=js(auth(users[0])+'select submit_trip_routed_settlement('+q(trip)+','+q(json.dumps(draft))+'::jsonb,'+q(uuid.uuid4())+','+q(review['digest'])+','+q(review['expiresAt'])+');')['id']
 for index,role,version in[(0,'payer',1),(2,'receiver',2)]:run(auth(users[index])+'select decide_trip_routed_settlement('+q(prop)+",'approve',"+str(version)+','+q(json.dumps({'actual:'+role:accounts[index]}))+'::jsonb);')
 first=hold(auth(users[0])+creator_sql)
 run(auth(users[1])+'select decide_trip_routed_settlement('+q(prop)+",'approve',3,'{}');",'balance_changed');commit(first)
 assert js(auth(users[1])+'select decide_trip_routed_settlement('+q(prop)+",'approve',3,'{}');")['status']=='stale'
 assert scalar('select count(*)from private.trip_routed_receipts where proposal='+q(prop)+';')=='0'
 print('PASS: ordinary routed final approval loses to creator direct posting without duplicate cash/coverage')
 # Reverse order: legacy confirmation commits, then creator preview cannot post stale native debt.
 f=fixture();users,ids,trip,accounts,draft=f;_,_,creator_sql=prepared(f)
 bundle=js(auth(users[0])+'select propose_fx_settlement_bundle('+q(uuid.uuid4())+','+q(trip)+','+q(ids[1])+",'MYR','custom','{}',10000,"+q(accounts[0])+');')['bundle_id']
 first=hold(auth(users[1])+'select respond_fx_settlement_bundle('+q(bundle)+",'accepted',1,"+q(accounts[1])+');')
 run(auth(users[0])+creator_sql,'balance_changed');commit(first)
 run(auth(users[0])+creator_sql,'invalid_routed_plan|quote_changed')
 assert scalar('select count(*)from private.creator_records where space_id='+q(trip)+';')=='0'
 print('PASS: legacy confirmation wins before creator; stale preview has no financial/outbox effects')

finally:
 for p in processes:
  if p.poll()is None:p.kill();p.communicate()
