"""Publish counts only; never expose fixture rows or connection state."""
import os,re
from pathlib import Path
if os.environ.get('GITHUB_ACTIONS')!='true':
    raise SystemExit('Isolated CI only')
p=Path('/tmp/tabby-db-tests.log')
if p.exists():
    content=p.read_text(errors='replace')
    count=re.search(r'Files=\d+, Tests=\d+[^\n]*',content)
    result=re.search(r'Result:\s*(PASS|FAIL)',content)
    if count and result:
        print('::notice title=Disposable PostgreSQL tests::'+count.group(0)+'; '+result.group(0))
