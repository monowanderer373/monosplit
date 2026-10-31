"""Actual competing editor commands; disposable loopback database only."""
import json
import os
import subprocess
import time
import uuid
from urllib.parse import urlsplit

url = os.environ.get('TRIP_EDITOR_TEST_DB_URL', '')
parsed = urlsplit(url)
assert parsed.hostname in ('127.0.0.1', 'localhost', '::1') and parsed.port == 54322 and parsed.path == '/postgres', 'Disposable loopback database required'
cmd = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', url]

def quoted(value):
    return "'" + str(value).replace("'", "''") + "'"

def run(sql, failure=None):
    result = subprocess.run(cmd, input=sql, text=True, capture_output=True, timeout=25)
    if failure:
        assert result.returncode != 0 and failure in result.stderr, 'Expected isolated rejection was not observed'
    else:
        assert result.returncode == 0, 'Disposable SQL failed; credentials and rows withheld'
    return result.stdout.strip().splitlines()

def auth(user):
    return 'set role authenticated;set request.jwt.claims=' + quoted(json.dumps({'sub': user, 'role': 'authenticated', 'is_anonymous': False})) + ';'

user, other = str(uuid.uuid4()), str(uuid.uuid4())
for value in (user, other):
    run("insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('00000000-0000-0000-0000-000000000000'," + quoted(value) + ",'authenticated','authenticated'," + quoted('editor-race-' + value + '@example.test') + ",'',now(),'{\"provider\":\"email\"}','{\"display_name\":\"Editor race\"}',now(),now());")
actor = run(auth(user) + 'select current_participant_id();')[-1]
peer = run(auth(other) + 'select current_participant_id();')[-1]
trip = run(auth(user) + "select create_space('trip','Editor race',null,null,'MYR');")[-1]
run('insert into public.space_members(space_id,participant_id,role)values(' + quoted(trip) + ',' + quoted(peer) + ",'full_access');")
payload = {'expense_scope': 'space', 'target_space_id': trip, 'participant_ids': [actor, peer], 'contribution_amounts': [10000, 0], 'share_amounts': [10000, 0], 'total_minor': 10000, 'currency_code': 'MYR', 'description': 'Shared original', 'category': 'Food', 'occurred_on': '2026-10-31'}
expense = json.loads(run(auth(user) + 'select create_trip_expense_editor(' + quoted(uuid.uuid4()) + ',' + quoted(trip) + ',' + quoted(json.dumps(payload)) + '::jsonb,array[' + quoted(actor) + ',' + quoted(peer) + ']::uuid[]);')[-1])['expense_id']
payload.update(expense_scope='personal', target_space_id=None, participant_ids=[actor], contribution_amounts=[10000], share_amounts=[10000], description='Private successor')

def save(request, target, version, note):
    next_payload = dict(payload, description=note)
    return 'select save_trip_expense_editor(' + quoted(request) + ',' + quoted(target) + ',' + str(version) + ',' + quoted(trip) + ",'private',true," + quoted(json.dumps(next_payload)) + '::jsonb,array[' + quoted(actor) + ']::uuid[]);'

def holder(sql):
    process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    process.stdin.write(sql + "select 'ready';\n")
    process.stdin.flush()
    for line in process.stdout:
        if line.strip() == 'ready':
            return process
    raise AssertionError('Holder failed before acquiring its transaction lock')

processes = []
try:
    lock = holder("begin;set local statement_timeout='15000ms';select private.lock_collect_pay_balance();")
    processes.append(lock)
    request = str(uuid.uuid4())
    run(auth(user) + save(request, expense, 1, 'Private successor'), failure='balance_changed')
    assert run('select status||version::text from public.expenses where id=' + quoted(expense) + ';')[-1] == 'active1'
    assert run('select count(*)from public.personal_money_operations where request_id=' + quoted(request) + ';')[-1] == '0'
    lock.communicate('commit;\n', timeout=15)
    assert lock.returncode == 0
    receipt = json.loads(run(auth(user) + save(request, expense, 1, 'Private successor'))[-1])
    assert json.loads(run(auth(user) + save(request, expense, 1, 'Private successor'))[-1]) == receipt
    target = receipt['expense_id']
    command = str(uuid.uuid4())
    first = holder(auth(user) + "begin;set local statement_timeout='15000ms';" + save(command, target, 1, 'One committed change'))
    processes.append(first)
    tag = 'editor-contender-' + str(uuid.uuid4())
    second = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    processes.append(second)
    second.stdin.write(auth(user) + 'set application_name=' + quoted(tag) + ";set statement_timeout='15000ms';" + save(command, target, 1, 'One committed change') + '\n')
    second.stdin.flush()
    waiting = False
    deadline = time.monotonic() + 5
    while time.monotonic() < deadline:
        waiting = run("select exists(select 1 from pg_stat_activity where application_name=" + quoted(tag) + "and wait_event_type='Lock'and wait_event='advisory');")[-1] == 't'
        if waiting or second.poll() is not None:
            break
        time.sleep(.05)
    assert waiting, 'Duplicate authenticated command must demonstrably wait'
    first.communicate('commit;\n', timeout=15)
    second.communicate(timeout=15)
    assert first.returncode == second.returncode == 0
    assert run('select version from public.expenses where id=' + quoted(target) + ';')[-1] == '2'
    assert run('select count(*)from public.personal_money_operations where request_id=' + quoted(command) + ';')[-1] == '1'
    assert run('select count(*)from public.personal_account_entries where owner_participant_id=' + quoted(actor) + ';')[-1] == '0'
    print('PASS: original balance lock excludes audience conversion, rollback leaves no receipt, competing duplicate Save commits once, no cash posted')
finally:
    for process in processes:
        if process.poll() is None:
            process.kill()
            process.communicate(timeout=5)
