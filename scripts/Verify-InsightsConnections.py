"""Read-only deployment/migration verification. Credentials come from secure env bindings.

No deployment, migration, financial write, credential output or TLS bypass.
Run: python3 scripts/Verify-InsightsConnections.py
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request

TEAM = 'monowanderer373s-projects'
PROJECT = 'tabby-tally'
SUPABASE_REF = 'skiqsxvmxvmxfzhrzcxh'


def request(base, path, token, payload=None):
    context = ssl.create_default_context(cafile=os.environ.get('SSL_CERT_FILE'))
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(base + path, data=data, headers={
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(req, context=context, timeout=30) as response:
        return json.load(response)


def verify():
    result = {}
    vercel = os.environ.get('VERCEL_TOKEN')
    supabase = os.environ.get('SUPABASE_ACCESS_TOKEN')
    if not vercel:
        result['vercel'] = {'connected': False, 'missing_binding': 'VERCEL_TOKEN'}
    else:
        try:
            teams = request('https://api.vercel.com', '/v2/teams', vercel)
            team = next(item for item in teams.get('teams', []) if item.get('slug') == TEAM)
            suffix = '?teamId=' + urllib.parse.quote(team['id'])
            project = request('https://api.vercel.com', '/v9/projects/' + PROJECT + suffix, vercel)
            deployments = request('https://api.vercel.com', '/v6/deployments' + suffix + '&target=production&projectId=' + urllib.parse.quote(project['id']), vercel)
            result['vercel'] = {'connected': True, 'team': team.get('slug'), 'project': project.get('name'), 'production': [
                {'id': item.get('uid'), 'state': item.get('state'), 'url': item.get('url'),
                 'commit': item.get('meta', {}).get('githubCommitSha'), 'branch': item.get('meta', {}).get('githubCommitRef')}
                for item in deployments.get('deployments', [])[:5]
            ]}
        except (urllib.error.HTTPError, urllib.error.URLError, StopIteration, KeyError) as error:
            result['vercel'] = {'connected': False, 'http_status': getattr(error, 'code', None), 'reason': 'Project connection verification failed; inspect binding/team access securely.'}
    if not supabase:
        result['supabase'] = {'connected': False, 'missing_binding': 'SUPABASE_ACCESS_TOKEN'}
    else:
        try:
            rows = request('https://api.supabase.com', '/v1/projects/' + SUPABASE_REF + '/database/query', supabase,
                           {'query': 'select version, name from supabase_migrations.schema_migrations order by version;'})
            result['supabase'] = {'connected': True, 'project_ref': SUPABASE_REF, 'migrations': rows}
        except (urllib.error.HTTPError, urllib.error.URLError) as error:
            result['supabase'] = {'connected': False, 'http_status': getattr(error, 'code', None), 'reason': 'Read-only migration history verification failed; inspect binding/project access securely.'}
    print(json.dumps(result, indent=2))
    return 0 if all(item.get('connected') for item in result.values()) else 2


if __name__ == '__main__':
    sys.exit(verify())
