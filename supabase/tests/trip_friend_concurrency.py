"""Real competing sessions, disposable local PostgreSQL only. No hosted URL accepted."""
import os,subprocess,json,time,uuid
from urllib.parse import urlsplit
url=os.environ.get('TRIP_FRIEND_TEST_DB_URL','');parsed=urlsplit(url)
assert parsed.hostname in('127.0.0.1','localhost','::1')and parsed.port==54322 and parsed.path=='/postgres','Disposable loopback database required'
cmd=['psql','-X','-qAt','-v','ON_ERROR_STOP=1',url]
def run(sql):
 p=subprocess.run(cmd,input=sql,text=True,capture_output=True,timeout=25)
 assert p.returncode==0,'Disposable SQL failed; no credentials logged'
 return p.stdout.strip().splitlines()
a,b=str(uuid.uuid4()),str(uuid.uuid4())
for user in[a,b]:run("insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('00000000-0000-0000-0000-000000000000','"+user+"','authenticated','authenticated','trip-friend-race-"+user+"@example.test','',now(),'{\"provider\":\"email\"}','{\"display_name\":\"Request race\"}',now(),now());")
def auth(user):return "set role authenticated;set request.jwt.claims='"+json.dumps({'sub':user,'role':'authenticated','is_anonymous':False})+"';"
ap=run(auth(a)+'select current_participant_id();')[-1];bp=run(auth(b)+'select current_participant_id();')[-1]
sid=run(auth(a)+"select create_space('trip','Request race',null,null,'MYR');")[-1]
run("insert into public.space_members(space_id,participant_id,role)values('"+sid+"','"+bp+"','view');")
first="select send_trip_friend_request('"+str(uuid.uuid4())+"','"+bp+"','"+sid+"');"
second="select send_trip_friend_request('"+str(uuid.uuid4())+"','"+ap+"','"+sid+"');"
holder=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);contender=None
try:
 holder.stdin.write(auth(a)+"begin;set local statement_timeout='15000ms';"+first+"select 'ready';\n");holder.stdin.flush()
 for line in holder.stdout:
  if line.strip()=='ready':break
 else:raise AssertionError('First transaction failed before lock')
 contender=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 tag='trip-friend-contender-'+str(uuid.uuid4());contender.stdin.write(auth(b)+"set application_name='"+tag+"';set statement_timeout='15000ms';"+second+'\n');contender.stdin.flush()
 waiting=False;end=time.monotonic()+5
 while time.monotonic()<end:
  waiting=run("select exists(select 1 from pg_stat_activity where application_name='"+tag+"'and wait_event_type='Lock'and wait_event='advisory');")[-1]=='t'
  if waiting or contender.poll()is not None:break
  time.sleep(.05)
 assert waiting,'Second authenticated sender must demonstrably wait on pair lock'
 holder.communicate('commit;\n',timeout=15);assert holder.returncode==0
 contender.communicate(timeout=15);assert contender.returncode==0
 assert run("select count(*)from public.trip_friend_requests where source_space_id='"+sid+"'and status='pending';")[-1]=='1'
 assert run("select count(*)from public.friendships where participant_low_id=least('"+ap+"'::uuid,'"+bp+"'::uuid)and participant_high_id=greatest('"+ap+"'::uuid,'"+bp+"'::uuid);")[-1]=='0'
 print('PASS: real pair-lock wait, opposite requests coalesced, no automatic acceptance')
finally:
 for p in[holder,contender]:
  if p and p.poll()is None:p.kill();p.communicate(timeout=5)
