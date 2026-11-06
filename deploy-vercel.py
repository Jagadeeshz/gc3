"""Trigger git-based production deployments and follow them to completion."""
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

API = 'https://api.vercel.com'
TEAM = 'team_on3g7iAEOdSh4keCM1YZ51Yk'
TARGET = sys.argv[1] if len(sys.argv) > 1 else 'gc3-api'


def token() -> str:
    path = pathlib.Path(os.environ['APPDATA']) / 'com.vercel.cli' / 'Data' / 'auth.json'
    return json.loads(path.read_text())['token']


TOKEN = token()


def call(method: str, path: str, body: dict | None = None):
    url = f'{API}{path}{"&" if "?" in path else "?"}teamId={TEAM}'
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={'authorization': f'Bearer {TOKEN}',
                                          'content-type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read() or b'{}')
    except urllib.error.HTTPError as error:
        raise SystemExit(f'{method} {path} -> {error.code}: {error.read().decode()[:400]}')


project = call('GET', f'/v9/projects/{TARGET}')
link = project.get('link') or {}
repo_id = link.get('repoId')
if not repo_id:
    raise SystemExit(f'{TARGET} is not linked to a repository: {json.dumps(link)[:200]}')

print(f'{TARGET}: deploying {link.get("org")}/{link.get("repo")}@{project.get("link", {}).get("productionBranch", "main")}')

deployment = call('POST', '/v13/deployments?forceNew=1', {
    'name': TARGET,
    'project': project['id'],
    'target': 'production',
    'gitSource': {'type': 'github', 'ref': 'main', 'repoId': repo_id},
})

dep_id = deployment['id']
print(f'  created {dep_id} ({deployment.get("url")})')

deadline = time.time() + 900
state = 'QUEUED'
while time.time() < deadline:
    time.sleep(12)
    current = call('GET', f'/v13/deployments/{dep_id}')
    state = current.get('readyState') or current.get('status')
    print(f'  {state}')
    if state in ('READY', 'ERROR', 'CANCELED'):
        break

if state != 'READY':
    events = call('GET', f'/v3/deployments/{dep_id}/events?limit=40')
    for event in events if isinstance(events, list) else events.get('events', []):
        text = event.get('text') or ''
        if text:
            print('   |', text[:200])
    raise SystemExit(f'{TARGET}: deployment ended {state}')

print(f'{TARGET}: READY -> https://{project.get("alias", [{}])[0].get("domain") if project.get("alias") else TARGET + ".vercel.app"}')
print(f'  deployment url: https://{deployment["url"]}')
