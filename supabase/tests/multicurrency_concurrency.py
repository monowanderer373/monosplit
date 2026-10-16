"""Real competing funding sessions. Strictly disposable loopback Supabase only."""
import json
import os
import shutil
import subprocess
import time
import uuid
from urllib.parse import urlsplit


def main():
    dsn = os.environ.get('MULTICURRENCY_TEST_DB_URL', '')
    parsed = urlsplit(dsn)
    if parsed.scheme not in ('postgres', 'postgresql') or parsed.hostname not in ('localhost', '127.0.0.1', '::1') or parsed.port != 54322 or parsed.path != '/postgres':
        raise SystemExit('Disposable loopback Supabase on port54322 required; no shared database allowed.')
    if not shutil.which('psql'):
        raise SystemExit('psql unavailable; concurrency NOT RUN.')
    command = ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', dsn]
    actor = str(uuid.uuid4())
    claims = json.dumps({'sub': actor, 'role': 'authenticated', 'is_anonymous': False})
    auth = f"set role authenticated; set request.jwt.claims='{claims}'; "

    def query(sql, authenticated=True):
        result = subprocess.run(command, input=(auth if authenticated else '') + sql, text=True, capture_output=True, timeout=12)
        assert result.returncode == 0, 'Unexpected SQL failure; private diagnostics omitted.'
        return [json.loads(line) for line in result.stdout.splitlines() if line.startswith(('{', '['))]

    query(f"insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('00000000-0000-0000-0000-000000000000','{actor}','authenticated','authenticated','mc-race-{actor}@example.test','',now(),'{{\"provider\":\"email\"}}','{{\"display_name\":\"MC Race QA\"}}',now(),now());", False)
    a, b = query("select create_personal_account(gen_random_uuid(),'MC race cash','cash','MYR',10000,current_date,false); select create_personal_account(gen_random_uuid(),'MC race bank','bank','MYR',10000,current_date,false);")
    account_ids = [a['account_id'], b['account_id']]

    def pending():
        return query("select create_expense_with_multicurrency_funding(gen_random_uuid(),jsonb_build_object('expense_scope','personal','total_minor',1000,'currency_code','MYR','description','Disposable MC concurrency','category','Food','occurred_on',current_date,'participant_ids',jsonb_build_array(current_participant_id()),'contribution_amounts',jsonb_build_array(1000),'share_amounts',jsonb_build_array(1000)),jsonb_build_object('mode','deferred','primary_account_id','" + account_ids[0] + "','legs','[]'::jsonb));")[0]

    def confirmation(item, request_id):
        units = query('select get_personal_multicurrency_accounts();')[0]['accounts']
        legs = [{'account_id': a['id'], 'amount_minor': 500, 'version': a['version'], 'parent_version': a['parent_version'], 'anchor_id': None, 'included_in_anchor': None} for a in units if a['id'] in account_ids]
        assert len(legs) == 2
        return f"select confirm_personal_funding_bundle('{request_id}','{item['funding']['funding_intent_id']}',1,1,'{json.dumps(legs)}'::jsonb,true);"

    def race(first_sql, second_sql, second_error=None):
        holder = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        contender = None
        try:
            holder.stdin.write(auth + "begin; set local statement_timeout='5000ms'; " + first_sql + "select 'holder-ready';\n")
            holder.stdin.flush()
            for line in holder.stdout:
                if line.strip() == 'holder-ready':
                    break
            else:
                raise AssertionError('Lock holder failed before acquiring funding lock.')
            contender = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            contender.stdin.write(auth + "set statement_timeout='5000ms'; " + second_sql + '\n')
            contender.stdin.flush()
            time.sleep(0.2)
            assert contender.poll() is None, 'Competing transaction did not wait for owner operation lock.'
            holder.communicate('commit;\n', timeout=10)
            assert holder.returncode == 0, 'Original transaction failed.'
            _, error = contender.communicate(timeout=10)
            assert (contender.returncode != 0) == bool(second_error), 'Unexpected competing transaction result.'
            if second_error:
                assert second_error in error, 'Expected stale competing target rejection absent.'
        finally:
            for process in (holder, contender):
                if process and process.poll() is None:
                    process.kill()
                    process.communicate(timeout=5)

    first = pending()
    same = confirmation(first, uuid.uuid4())
    race(same, same)
    second = pending()
    original = confirmation(second, uuid.uuid4())
    competing = original.replace(original.split("'")[1], str(uuid.uuid4()), 1)
    race(original, competing, 'funding_not_pending')
    units = query('select get_personal_multicurrency_accounts();')[0]['accounts']
    assert all(int(a['entry_sum_minor']) == 9000 for a in units if a['id'] in account_ids), 'Duplicate or partial native debits detected.'
    check = query("select jsonb_build_object('legs',(select count(*) from personal_funding_bundle_legs),'bundles',(select count(*) from personal_funding_bundles where confirmed_operation_id is not null));")[0]
    assert check == {'legs': 4, 'bundles': 2}, 'One immutable set of legs per confirmed target required.'
    print('PASS: overlapping same-request replay creates one complete bundle; competing new request rejects stale target; four exact native legs, no duplicate or partial debits.')


if __name__ == '__main__':
    main()
