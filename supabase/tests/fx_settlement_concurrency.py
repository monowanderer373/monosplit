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

users = [str(uuid.uuid4()) for _ in range(3)]
for user in users:
    run("insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('00000000-0000-0000-0000-000000000000',"+q(user)+",'authenticated','authenticated',"+q('fx-race-'+user+'@example.test')+",'',now(),'{\"provider\":\"email\"}','{\"display_name\":\"FX race\"}',now(),now());")
recipient,payer,third = [run(auth(u)+'select current_participant_id();')[-1] for u in users]
trip = run(auth(users[0])+"select create_space('trip','Isolated FX race',null,null,'MYR');")[-1]
run("insert into public.space_members(space_id,participant_id,role)values("+q(trip)+','+q(payer)+",'view'),("+q(trip)+','+q(third)+",'view');")
expense_ids=[]
for currency,paid,consumer,minor in [('MYR',recipient,payer,10000),('VND',payer,recipient,120000)]:
    payload={'expense_scope':'space','target_space_id':trip,'participant_ids':[paid,consumer],'contribution_amounts':[minor,0],'share_amounts':[0,minor],'total_minor':minor,'currency_code':currency,'description':'FX race source','category':'Food','occurred_on':'2026-11-04'}
    data=json.loads(run(auth(users[0])+'select create_trip_expense_editor('+q(uuid.uuid4())+','+q(trip)+','+q(json.dumps(payload))+'::jsonb,array['+q(paid)+','+q(consumer)+']::uuid[]);')[-1]);expense_ids.append(data['expense_id'])
versions=[{'id':i,'version':1} for i in sorted(expense_ids)]
def account(user):
    return json.loads(run(auth(user)+'select create_personal_account('+q(uuid.uuid4())+",'FX race cash','cash','MYR',null,null,false);")[-1])['account_id']
receiver_account=account(users[0]);payer_account=account(users[1])
def propose(request):
    return 'select propose_fx_settlement_bundle('+','.join([q(request),q(trip),q(recipient),"'MYR'","'custom'","'{\"VND\":\"6000\"}'::jsonb",'8000',q(payer_account),'null',q(json.dumps(versions))+'::jsonb','8000',"'full'"])+');'
def balance(a,b,currency):
    return int(run('select private.space_signed_outstanding('+q(trip)+','+q(a)+','+q(b)+','+q(currency)+');')[-1])
def sums():
    return [int(run('select coalesce(sum(amount_minor),0)from public.personal_account_entries where account_id='+q(a)+';')[-1]) for a in [payer_account,receiver_account]]
def facts():
    return run('select md5(jsonb_agg(to_jsonb(e)order by id)::text)from public.expenses e where space_id='+q(trip)+';')[-1]
original=facts();processes=[];request=str(uuid.uuid4())
try:
    first=hold(auth(users[1])+propose(request));processes.append(first)
    run(auth(users[1])+propose(uuid.uuid4()),'balance_changed')
    assert int(run('select count(*)from public.settlement_fx_bundles where space_id='+q(trip)+';')[-1])==0, 'Uncommitted bundle escaped isolation'
    commit(first)
    bundle=json.loads(run(auth(users[1])+propose(request))[-1])['bundle_id']
    run(auth(users[1])+propose(uuid.uuid4()),'no_outstanding_debt')
    assert sums()==[0,0] and balance(payer,recipient,'MYR')==10000, 'Pending changed cash/debt'
    run(auth(users[2])+"select respond_fx_settlement_bundle("+q(bundle)+",'accepted',1,null);",'settlement_participant_denied')
    accept="select respond_fx_settlement_bundle("+q(bundle)+",'accepted',1,"+q(receiver_account)+');'
    first=hold(auth(users[0])+accept);processes.append(first)
    run(auth(users[0])+accept,'balance_changed')
    commit(first)
    run(auth(users[0])+accept)
    assert sums()==[-8000,8000] and balance(payer,recipient,'MYR')==0 and balance(recipient,payer,'VND')==0, 'Atomic FX acceptance/cash failed'
    run(auth(users[2])+accept,'settlement_participant_denied')
    reverse_request=str(uuid.uuid4())
    reverse='select reverse_fx_settlement_bundle('+q(reverse_request)+','+q(bundle)+',2);'
    first=hold(auth(users[1])+reverse);processes.append(first)
    run(auth(users[0])+'select reverse_fx_settlement_bundle('+q(uuid.uuid4())+','+q(bundle)+',2);','balance_changed')
    commit(first);run(auth(users[1])+reverse)
    assert sums()==[0,0] and balance(payer,recipient,'MYR')==10000 and balance(recipient,payer,'VND')==120000 and facts()==original, 'Reverse changed original facts or duplicated cash'
    first=hold('update public.expenses set version=version+1 where id='+q(expense_ids[0])+';');processes.append(first)
    stale_request=str(uuid.uuid4());run(auth(users[1])+propose(stale_request),'balance_changed');commit(first)
    run(auth(users[1])+propose(stale_request),'quote_changed')
    assert int(run('select count(*)from public.settlement_fx_bundles where client_request_id='+q(stale_request)+';')[-1])==0 and sums()==[0,0], 'Stale quote left a partial reservation/cash fact'
    print('PASS: overlapping propose/confirm/reverse, stable retry, third-party denial, exact two-sided cash, immutable originals and real writer/stale-quote rollback')
finally:
    for proc in processes:
        if proc.poll()is None:
            try:proc.communicate('rollback;\n',timeout=5)
            except subprocess.TimeoutExpired:proc.kill()
