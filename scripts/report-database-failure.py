"""Expose bounded isolated CI diagnostics; never use on production account logs."""
import os,re
from pathlib import Path
if os.environ.get('GITHUB_ACTIONS') != 'true':
    raise SystemExit('Isolated GitHub Actions diagnostics only')
for filename in ['/tmp/tabby-db-lint.log','/tmp/tabby-history-apply.log','/tmp/tabby-db-tests.log']:
    path=Path(filename)
    if not path.exists():continue
    lines=path.read_text(errors='replace').splitlines()
    indices=set(range(max(0,len(lines)-35),len(lines)))
    for n,line in enumerate(lines):
        if re.search(r'ERROR:|not ok|Failed test|Parse errors|Dubious',line):
            indices.update(range(max(0,n-2),min(len(lines),n+9)))
    text='\n'.join(lines[n]for n in sorted(indices))
    # Check annotations truncate around4096bytes; split before escaping to retain the actual cause.
    for start in range(0,min(len(text),14000),2800):
        chunk=text[start:start+2800].replace('%','%25').replace('\r','%0D').replace('\n','%0A')
        print('::error title=Disposable database diagnostics::'+chunk)
