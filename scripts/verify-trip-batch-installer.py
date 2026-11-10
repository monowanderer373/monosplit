"""No DB connection: ensure SQL Editor wrapping preserves both exact canonical migration byte payloads."""
from pathlib import Path
import re,base64,hashlib,textwrap
root=Path(__file__).resolve().parents[1];script=(root/'docs/runbooks/trip-batch-production-apply.sql').read_text()
for i,version in enumerate(['202611050001','202611050002']):
 raw=next((root/'supabase/migrations').glob(version+'_*.sql')).read_bytes();pattern=rf'\$tabby_payload_{i}\$(.*?)\$tabby_payload_{i}\$'
 for variant in[script,script.replace('\n','\r\n'),'\n'.join('  '+line for line in script.splitlines())]:
  match=re.search(pattern,variant,re.S);assert match
  assert base64.b64decode(''.join(match[1].split()),validate=True)==raw
  assert hashlib.sha256(raw).hexdigest()in variant
 wrapped=textwrap.fill(''.join(re.search(pattern,script,re.S)[1].split()),37,initial_indent='  ',subsequent_indent='\t')
 assert base64.b64decode(''.join(wrapped.split()),validate=True)==raw
print('PASS:001+002 exact canonical bytes in LF, CRLF, SQL Editor indent and37-column wrapped transport')
