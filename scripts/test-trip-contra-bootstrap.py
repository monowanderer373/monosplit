"""Exercise the real HTTP installer only on an isolated creator-baseline database.

Requires the genuine 42-version pre-Contra baseline; installs Contra on success.
Never accepts a remote or production connection. No mock HTTP functions.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--db-url', required=True)
args = parser.parse_args()
url = urlsplit(args.db_url)
assert url.hostname in ('localhost', '127.0.0.1', '::1') and (
    (url.port == 54322 and url.path == '/postgres') or
    (url.port == 55439 and url.path == '/tabby_contra_upgrade')
), 'Disposable loopback database required'


def query(sql, error=None):
    result = subprocess.run(
        ['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', args.db_url],
        input=sql, text=True, capture_output=True, timeout=90,
    )
    if error:
        assert result.returncode and error in result.stderr, result.stderr
    else:
        assert result.returncode == 0, result.stderr
    return result.stdout.strip()


def financial_rows():
    # Include full contents, not just row counts, of all application tables.
    tables = json.loads(query("""select coalesce(json_agg(format('%I.%I',n.nspname,c.relname)), '[]')
        from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','private') and c.relkind in ('r','p');"""))
    return {table: query(f"select count(*)||':'||md5(coalesce(string_agg(md5(row_to_json(t)::text),'' order by md5(row_to_json(t)::text)),'')) from {table} t;") for table in tables}


def schema_state():
    return query("""select jsonb_build_object(
        'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
        'functions',(select jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)),p.proacl) order by p.oid::regprocedure::text)
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
          where n.nspname in ('public','private') and p.prokind='f'))::text;""")


assert query('select count(*) from supabase_migrations.schema_migrations;') == '42', 'Creator baseline required'
assert query("select to_regprocedure('public.read_trip_contra_snapshot(uuid,text,text,text)') is null;") == 't'
before_rows, before_schema = financial_rows(), schema_state()
bootstrap = (root / 'docs/runbooks/trip-contra-production-bootstrap.sql').read_text()
canonical = (root / 'docs/runbooks/trip-contra-production-apply.sql').read_text()
checks = []
cases = [
    ('reported truncation', canonical[:canonical.index('$contra_install$') + 27083], '42601'),
    ('HTTP failure', bootstrap.replace('trip-contra-production-apply.sql', 'missing-contra-installer.sql'), 'Contra download failed (HTTP 404)'),
    ('incomplete download', bootstrap.replace('docs/runbooks/trip-contra-production-apply.sql', 'README.md'), 'Contra download incomplete or changed'),
    ('checksum mismatch', bootstrap.replace('ae9f32512c617ba993ebae8a794f8acd0db0a5765fe77b6fe6bc7ed4d94329ba', '0e9f32512c617ba993ebae8a794f8acd0db0a5765fe77b6fe6bc7ed4d94329ba'), 'Contra download incomplete or changed'),
    ('post-install rollback', bootstrap.replace('execute installer;', "execute installer; raise exception 'Injected post-install failure';"), 'Injected post-install failure'),
]
for name, sql, error in cases:
    query(sql, error)
    assert schema_state() == before_schema, name + ': schema changed'
    assert financial_rows() == before_rows, name + ': application rows changed'
    checks.append(name + ': PASS, no committed changes')

marker = 'TABBY_TRIP_CONTRA_INSTALL_COMPLETE_20261112'
assert marker in query(bootstrap)
audit_result = subprocess.run([sys.executable, str(root / 'scripts/verify-trip-contra-production.py'), '--db-url', args.db_url, '--before-trip-shared-balances'], check=True, text=True, capture_output=True)
audit = json.loads(audit_result.stdout)
installed_schema = schema_state()
assert financial_rows() == before_rows
checks.append('real HTTPS creator-baseline upgrade: PASS, application rows unchanged')
assert marker in query(bootstrap)
assert schema_state() == installed_schema and financial_rows() == before_rows
checks.append('identical replay: PASS, schema and application rows unchanged')
print(json.dumps({'checks': checks, 'applicationTablesChecked': len(before_rows), 'audit': audit}, indent=2))
