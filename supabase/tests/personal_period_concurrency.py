"""Fresh Start competing-session integration: disposable loopback stack ONLY."""
import json
import os
import random
import shutil
import subprocess
import time
import uuid
from urllib.parse import urlsplit


def main():
    dsn=os.environ.get('PERSONAL_PERIOD_TEST_DB_URL','')
    u=urlsplit(dsn)
    if u.scheme not in ('postgres','postgresql') or u.hostname not in ('localhost','127.0.0.1','::1') or u.port!=54322 or u.path!='/postgres':
        raise SystemExit('Disposable loopback Supabase required. Production/shared database forbidden.')
    if not shutil.which('psql'):
        raise SystemExit('psql unavailable; NOT RUN')
    cmd=['psql','-X','-qAt','-v','ON_ERROR_STOP=1',dsn]
    actor=str(uuid.uuid4())
    claims=json.dumps({'sub':actor,'role':'authenticated','is_anonymous':False,'amr':[{'method':'password','timestamp':int(time.time())}]})
    auth="set role authenticated; set request.jwt.claims='"+claims+"'; "

    def query(sql,authenticated=True):
        result=subprocess.run(cmd,input=(auth if authenticated else '')+sql,text=True,capture_output=True,timeout=35)
        assert result.returncode==0,'SQL integration failure (private diagnostics omitted)'
        return [json.loads(line)for line in result.stdout.splitlines()if line.startswith(('{','['))]

    query("insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('00000000-0000-0000-0000-000000000000','"+actor+"','authenticated','authenticated','period-race-"+actor+"@example.test','',now(),'{\"provider\":\"email\"}','{\"display_name\":\"Period Race QA\"}',now(),now());",False)
    account=query("select create_personal_account(gen_random_uuid(),'Period race cash','cash','MYR',10000,current_date,false);")[0]['account_id']

    def reviewed_command(request_id=None,observed=None):
        preview=query('select preview_personal_fresh_start();')[0]
        openings=[{'account_id':a['account_id'],'amount_minor':a['balance_minor']if a['known']else'0'}for a in preview['accounts']]
        if observed is not None:
            next(a for a in openings if a['account_id']==account)['amount_minor']=str(observed)
        rid=request_id or str(uuid.uuid4())
        return rid,"select apply_personal_fresh_start('"+rid+"','"+preview['id']+"','"+json.dumps(openings)+"'::jsonb);"

    def race(first,second,expected_error=None,wait_kind='advisory'):
        holder=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        contender=None
        try:
            holder.stdin.write(auth+"begin; set local statement_timeout='12000ms'; "+first+"select 'period-holder-ready';\n")
            holder.stdin.flush()
            for line in holder.stdout:
                if line.strip()=='period-holder-ready':
                    break
            else:
                raise AssertionError('Original transaction failed before acquiring lock')
            contender=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            tag='period-contender-'+str(uuid.uuid4())
            contender.stdin.write(auth+"set application_name='"+tag+"'; set statement_timeout='12000ms'; "+second+'\n')
            contender.stdin.flush()
            deadline=time.monotonic()+4
            waiting=False
            while time.monotonic()<deadline:
                waiting=query("select jsonb_build_object('waiting',exists(select 1 from pg_stat_activity where application_name='"+tag+"'and wait_event_type='Lock'and wait_event='"+wait_kind+"'));",False)[0]['waiting']
                if waiting or contender.poll()is not None:
                    break
                time.sleep(.05)
            assert waiting and contender.poll()is None,'Second real session did not demonstrably wait on the required lock'
            holder.communicate('commit;\n',timeout=15)
            assert holder.returncode==0,'Original transaction did not commit'
            _,error=contender.communicate(timeout=15)
            assert (contender.returncode!=0)==bool(expected_error),'Wrong competing outcome'
            if expected_error:
                assert expected_error in error,'Expected conflict was not reported'
        finally:
            for p in [holder,contender]:
                if p and p.poll()is None:
                    p.kill();p.communicate(timeout=5)

    rid,original=reviewed_command()
    race(original,original)
    state=query('select get_personal_ledger_period_state();')[0]
    assert len(state['periods'])==2,'Replay created a duplicate epoch'
    assert query("select reconcile_personal_fresh_start('"+rid+"');")[0]['state']=='committed'
    # The ordinary account writer does NOT use the Fresh Start advisory lock.
    # An actual table-lock wait must still serialize it with fingerprint review.
    _,stale=reviewed_command()
    version=query("select jsonb_build_object('version',version)from personal_accounts where id='"+account+"';")[0]['version']
    rename="select update_personal_account(gen_random_uuid(),'"+account+"','Changed during reset',"+str(version)+");"
    race(rename,stale,'fresh_start_preview_changed','relation')
    assert len(query('select get_personal_ledger_period_state();')[0]['periods'])==2,'Stale review partially committed'
    # Unknown response reconciliation waits for an actual in-flight commit.
    rid,original=reviewed_command()
    race(original,"select reconcile_personal_fresh_start('"+rid+"');")
    rid,late=reviewed_command()
    race("select reconcile_personal_fresh_start('"+rid+"');",late,'fresh_start_request_fenced')
    # Verify multiple fresh-period/opening replays never manufacture balance.
    balances=query('select get_personal_multicurrency_accounts();')[0]['accounts']
    assert next(a for a in balances if a['id']==account)['entry_sum_minor']in ('10000',10000)
    generator=random.Random(20261025)
    for observed in [0,-1,1]+[generator.randrange(-1000000,1000000)for _ in range(12)]:
        history=query('select jsonb_object_agg(e.id,to_jsonb(e))from personal_account_entries e;')[0]
        _,sql=reviewed_command(observed=observed)
        first=query(sql)[0]
        assert query(sql)[0]==first,'Replay changed receipt during native-balance property checks'
        units=query('select get_personal_multicurrency_accounts();')[0]['accounts']
        assert int(next(a for a in units if a['id']==account)['entry_sum_minor'])==observed,'Native opening conservation failed'
        later=query('select jsonb_object_agg(e.id,to_jsonb(e))from personal_account_entries e;')[0]
        assert all(later[k]==v for k,v in history.items()),'Reset rewrote an earlier immutable entry'
    print('PASS: duplicate commit, real ordinary-writer exclusion/stale rollback, in-flight receipt recovery, delayed-request fence and native opening conservation / 15 deterministic signed-balance property samples')


if __name__=='__main__':
    main()
