from pathlib import Path
import re,hashlib,base64,textwrap
root=Path(__file__).resolve().parents[1];s=(root/'docs/runbooks/trip-contra-production-apply.sql').read_text()
for version,tag in[('202611120001','contra_payload')]:
 raw=next((root/'supabase/migrations').glob(version+'_*.sql')).read_bytes()
 for content in[s,s.replace('\n','\r\n'),'\n'.join('  '+line for line in s.splitlines())]:
  payload=''.join(re.search(r'\$'+tag+r'\$(.*?)\$'+tag+r'\$',content,re.S)[1].split());assert base64.b64decode(payload,validate=True)==raw;assert hashlib.sha256(raw).hexdigest()in content;assert base64.b64decode(''.join(textwrap.fill(payload,37).split()))==raw
print('PASS: bilateral-contra exact canonical transport, LF/CRLF/indent/wrapped payload')
bootstrap=(root/'docs/runbooks/trip-contra-production-bootstrap.sql').read_text()
assert len(bootstrap.encode())<2500
assert str(len(s.encode()))in bootstrap and hashlib.sha256(s.encode()).hexdigest()in bootstrap
assert '16fcbb7d9d9eba1129fde718838a9319dbb6d2a0/docs/runbooks/trip-contra-production-apply.sql'in bootstrap
assert len(s)-len(s.replace('\nbegin;\n','\n').replace('\ncommit;\n','\n'))==15
assert bootstrap.index('extensions.digest')<bootstrap.index('execute installer;')
print('PASS: short bootstrap immutable source, exact size/SHA and transaction wrapper')
