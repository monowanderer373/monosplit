"""Real overlapping PostgreSQL commands; disposable loopback Supabase only."""
import json
import os
import subprocess
import uuid
from urllib.parse import urlsplit

url = os.environ.get('FX_SETTLEMENT_TEST_DB_URL', '')
p = urlsplit(url)
assert p.hostname in ('127.0.0.1', 'localhost', '::1') and p.port == 54322 and p.path == '/postgres', 'Disposable loopback database required'
cmd = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', url]

def q(value):
    return "'" + str(value).replace("'", "''") + "'"

def run(sql, failure=None):
    r = subprocess.run(cmd, input=sql, text=True, capture_output=True, timeout=20)
    if failure:
        assert r.returncode and failure in r.stderr, 'Expected isolated rejection absent; DSN/rows withheld'
    else:
        assert r.returncode == 0, 'Disposable FX query failed; DSN/rows withheld'
    return r.stdout.strip().splitlines()

def auth(user):
    return 'set role authenticated;set request.jwt.claims=' + q(json.dumps({'sub':user, 'role':'authenticated', 'is_anonymous':False})) + ';'

def hold(sql):
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    proc.stdin.write("begin;set local statement_timeout='10000ms';" + sql + "select 'fx-session-ready';\n")
    proc.stdin.flush()
    for line in proc.stdout:
        if line.strip() == 'fx-session-ready':
            return proc
    raise AssertionError('FX holder failed before acquiring its lock; rows withheld')

def commit(proc):
    proc.communicate('commit;\n', timeout=15)
    assert proc.returncode == 0, 'FX holder did not commit'

# Two real overlapping sessions. The first request holds the same global finance mutex as legacy.
users=[str(uuid.uuid4())for _ in range(3)]
for user in users:
 run("insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('00000000-0000-0000-0000-000000000000',"+q(user)+",'authenticated','authenticated',"+q('batch-race-'+user+'@example.test')+",'',now(),'{\"provider\":\"email\"}','{\"display_name\":\"Batch race\"}',now(),now());")
payer,a,b=[run(auth(u)+'select current_participant_id();')[-1]for u in users]
trip=run(auth(users[0])+"select create_space('trip','Isolated batch race',null,null,'MYR');")[-1]
run("insert into public.space_members(space_id,participant_id,role)values("+q(trip)+','+q(a)+",'full_access'),("+q(trip)+','+q(b)+",'full_access');")
for paid,minor in[(a,10000),(b,5000)]:
 payload={'expense_scope':'space','target_space_id':trip,'participant_ids':[paid,payer],'contribution_amounts':[minor,0],'share_amounts':[0,minor],'total_minor':minor,'currency_code':'MYR','description':'Batch race source','category':'Food','occurred_on':'2026-11-05'}
 run(auth(users[0])+'select create_trip_expense_editor('+q(uuid.uuid4())+','+q(trip)+','+q(json.dumps(payload))+'::jsonb,array['+q(paid)+','+q(payer)+']::uuid[]);')
def account(currency):return json.loads(run(auth(users[0])+'select create_personal_account('+q(uuid.uuid4())+",'Batch race cash','cash',"+q(currency)+',null,null,false);')[-1])['account_id']
myr=account('MYR');vnd=account('VND')
draft=[{'participantId':a,'cash':[{'currency':'MYR','amountMinor':'5000','accountId':myr},{'currency':'VND','amountMinor':'300000','accountId':vnd}]},{'participantId':b,'cash':[{'currency':'MYR','amountMinor':'5000','accountId':myr}]}]
def quote():return json.loads(run(auth(users[0])+'select quote_trip_settlement_batch('+q(trip)+",'custom','6000',null,"+q(json.dumps(draft))+'::jsonb);')[-1])['quoteId']
q1,q2=quote(),quote();request=str(uuid.uuid4());other=str(uuid.uuid4());processes=[]
def submit(quote_id,request_id):return 'select submit_trip_settlement_batch('+q(quote_id)+','+q(request_id)+');'
try:
 first=hold(auth(users[0])+submit(q1,request));processes.append(first)
 run(auth(users[0])+'select propose_fx_settlement_bundle('+q(uuid.uuid4())+','+q(trip)+','+q(a)+",'MYR','custom','{}',10000,"+q(myr)+');','balance_changed')
 # Same-actor account/request fencing waits for first transaction instead of racing past it.
 second=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);processes.append(second)
 app='batch-race-'+str(uuid.uuid4());second.stdin.write('set application_name='+q(app)+";set statement_timeout='15000ms';"+auth(users[0])+submit(q2,other)+'\n');second.stdin.flush()
 import time
 for _ in range(100):
  if run("select count(*)from pg_stat_activity where application_name="+q(app)+" and wait_event_type='Lock';")[-1]=='1':break
  time.sleep(.05)
 else:raise AssertionError('Second real session did not overlap blocked transaction')
 commit(first)
 _,err=second.communicate('',timeout=20)
 assert second.returncode and 'pending_pair'in err,'Competing batch did not reject reserved pair'
 receipt=json.loads(run(auth(users[0])+submit(q1,request))[-1]);assert len(receipt['children'])==2
 assert run('select count(*)from public.trip_settlement_batches where space_id='+q(trip)+';')[-1]=='1'
 assert run('select count(*)from public.settlement_fx_bundles where space_id='+q(trip)+';')[-1]=='2'
 assert json.loads(run(auth(users[0])+submit(q1,request))[-1])==receipt,'Repeated ID changed receipt'
 run(auth(users[0])+submit(q2,request),'idempotency_conflict')
 recovery=json.loads(run(auth(users[0])+'select reconcile_personal_money_operation('+q(request)+');')[-1]);assert recovery=={'state':'committed','result':receipt}
 retired=str(uuid.uuid4());assert json.loads(run(auth(users[0])+'select reconcile_personal_money_operation('+q(retired)+');')[-1])['state']=='not_posted'
 run(auth(users[0])+submit(q2,retired),'idempotency_conflict')
 assert run('select count(*)from public.personal_account_transactions where owner_participant_id='+q(payer)+" and kind='settlement_out';")[-1]=='0'
 print('PASS: overlapping batch/batch and legacy/batch; whole receipt replay, different-content rejection, refresh recovery and retired late-request fence; pending posts no cash')
finally:
 for p in processes:
  if p.poll()is None:p.kill();p.communicate()
