from pathlib import Path
import re,hashlib,base64,textwrap
root=Path(__file__).resolve().parents[1];s=(root/'docs/runbooks/trip-contra-production-apply.sql').read_text()
for version,tag in[('202611120001','contra_payload')]:
 raw=next((root/'supabase/migrations').glob(version+'_*.sql')).read_bytes()
 for content in[s,s.replace('\n','\r\n'),'\n'.join('  '+line for line in s.splitlines())]:
  payload=''.join(re.search(r'\$'+tag+r'\$(.*?)\$'+tag+r'\$',content,re.S)[1].split());assert base64.b64decode(payload,validate=True)==raw;assert hashlib.sha256(raw).hexdigest()in content;assert base64.b64decode(''.join(textwrap.fill(payload,37).split()))==raw
print('PASS: bilateral-contra exact canonical transport, LF/CRLF/indent/wrapped payload')
