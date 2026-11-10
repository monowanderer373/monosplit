from pathlib import Path
import re,hashlib,base64,textwrap
root=Path(__file__).resolve().parents[1];s=(root/'docs/runbooks/trip-routed-production-apply.sql').read_text();r=next((root/'supabase/migrations').glob('202611100001_*.sql')).read_bytes()
for content in[s,s.replace('\n','\r\n'),'\n'.join('  '+line for line in s.splitlines())]:
 payload=''.join(re.search(r'\$tabby_routed_payload\$(.*?)\$tabby_routed_payload\$',content,re.S)[1].split());assert base64.b64decode(payload,validate=True)==r;assert hashlib.sha256(r).hexdigest()in content;assert base64.b64decode(''.join(textwrap.fill(payload,37).split()))==r
print('PASS: complete batch+routed exact canonical transport, LF/CRLF/indent/wrapped payload')
