"""Prepare only the disposable native CI stack; never reuse another database."""
import os
from pathlib import Path
import re
import socket
import tomllib

if os.environ.get('GITHUB_ACTIONS') != 'true' or os.environ.get('CI') != 'true':
    raise SystemExit('Disposable GitHub Actions runner required')
run = os.environ.get('GITHUB_RUN_ID', '')
attempt = os.environ.get('GITHUB_RUN_ATTEMPT', '')
if not run.isdigit() or not attempt.isdigit() or not os.environ.get('GITHUB_ENV'):
    raise SystemExit('Expected isolated workflow identity and environment file')
path = Path('supabase/config.toml')
text = path.read_text()
config = tomllib.loads(text)
if config['project_id'] != 'MonoSplit' or config['api']['port'] != 54321 or config['db']['port'] != 54322:
    raise SystemExit('Inspect unexpected local stack configuration before modifying it')


def available(port):
    try:
        with socket.socket() as listener:
            listener.bind(('0.0.0.0', port))
        return True
    except OSError:
        return False


if not available(54321):
    print('::error title=Isolated native stack::API port 54321 is occupied; no existing service will be reused or stopped')
    raise SystemExit(2)
port = next((p for p in [54322, *range(54332, 54342)] if available(p)), None)
if port is None:
    raise SystemExit('No free isolated database port')
text, projects = re.subn(r'^project_id = "MonoSplit"$', f'project_id = "MonoSplitNative_{run}_{attempt}"', text, flags=re.M)
text, ports = re.subn(r'(^\[db\]\n.*?^port = )54322\b', lambda m: m[1] + str(port), text, count=1, flags=re.M | re.S)
assert projects == ports == 1
assert tomllib.loads(text)['db']['port'] == port
path.write_text(text)
with Path(os.environ['GITHUB_ENV']).open('a') as environment:
    environment.write(f'LOCAL_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:{port}/postgres\n')
print(f'Prepared a unique disposable native project on database port {port}; existing services unchanged')
