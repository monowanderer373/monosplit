"""Expose schema diagnostics through check annotations when runner logs are unavailable.
Only isolated CI output is accepted. Never use this on production account logs.
"""
import os
from pathlib import Path
if os.environ.get('GITHUB_ACTIONS') != 'true':
    raise SystemExit('Isolated GitHub Actions diagnostics only')
for filename in ['/tmp/tabby-db-lint.log', '/tmp/tabby-history-apply.log', '/tmp/tabby-db-tests.log']:
    path=Path(filename)
    if not path.exists():
        continue
    lines=path.read_text(errors='replace').splitlines()
    # linter emits no credentials; include its complete small diagnostic objects.
    picked=lines[-65:]
    text='\n'.join(picked).replace('%','%25').replace('\r','%0D').replace('\n','%0A')
    print('::error title=Disposable database diagnostics::'+text)
