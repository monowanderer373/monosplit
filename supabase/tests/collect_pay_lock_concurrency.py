"""Two real PostgreSQL sessions; disposable local Supabase only, no fixture writes.

Run after migrations: COLLECT_PAY_TEST_DB_URL=postgresql://postgres:...@127.0.0.1:54322/postgres
python3 supabase/tests/collect_pay_lock_concurrency.py
This is separate from pgTAP because the latter keeps fixtures in one transaction.
"""
import os
import shutil
import subprocess
from urllib.parse import urlsplit


def main():
    dsn = os.environ.get("COLLECT_PAY_TEST_DB_URL", "")
    parsed = urlsplit(dsn)
    if parsed.scheme not in ("postgres", "postgresql") or parsed.hostname not in (
        "127.0.0.1", "localhost", "::1"
    ) or parsed.port != 54322 or parsed.path != "/postgres":
        raise SystemExit("Provide a disposable LOCAL Supabase database on port 54322.")
    if not shutil.which("psql"):
        raise SystemExit("psql unavailable; concurrency checks NOT run.")
    command = ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", dsn]

    def query(sql, success=True, error=None):
        result = subprocess.run(command, input=sql, text=True, capture_output=True, timeout=8)
        assert (result.returncode == 0) == success, "Unexpected SQL result (DSN omitted)."
        if error:
            assert error in result.stderr, "Expected concurrency rejection absent."

    def locked_session(sql):
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, text=True)
        process.stdin.write("begin; set local statement_timeout='3000ms'; " + sql +
                            "; select 'lock-ready';\n")
        process.stdin.flush()
        # read has a server-side statement timeout; failed setup exits psql.
        assert process.stdout.readline().strip() == "lock-ready", "Lock setup failed."
        return process

    def release(process):
        if process.poll() is None:
            process.communicate("rollback;\n", timeout=8)
        assert process.returncode == 0, "Lock holder did not roll back cleanly."

    holder = locked_session("lock table public.expenses in share mode")
    try:
        query("begin; set local statement_timeout='2000ms'; "
              "select private.lock_collect_pay_balance(); rollback;", False, "balance_changed")
    finally:
        release(holder)

    holder = locked_session("do $$ begin perform private.lock_collect_pay_balance(); end; $$")
    try:
        query("set statement_timeout='2000ms'; select count(*) from public.expenses;")
        query("set statement_timeout='1000ms'; select id from public.expenses where false for update;",
              False, "statement timeout")
        query("set statement_timeout='1000ms'; update public.expenses set version=version where false;",
              False, "statement timeout")
    finally:
        release(holder)
    print("PASS: competing lock rejected, ordinary reads available, row-locking/write paths excluded.")


if __name__ == "__main__":
    main()
