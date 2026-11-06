"""Configure the two Vercel projects non-interactively (root dir, build commands, env).

Reads the CLI's own auth token — never prints it, never writes it anywhere.
"""
import json
import os
import pathlib
import secrets
import urllib.error
import urllib.request

API = 'https://api.vercel.com'
TEAM = 'team_on3g7iAEOdSh4keCM1YZ51Yk'


def token() -> str:
    candidates = [
        pathlib.Path(os.environ['APPDATA']) / 'com.vercel.cli' / 'Data' / 'auth.json',
        pathlib.Path(os.environ['APPDATA']) / 'com.vercel.cli' / 'auth.json',
        pathlib.Path.home() / '.vercel' / 'auth.json',
        pathlib.Path.home() / 'AppData' / 'Roaming' / 'com.vercel.cli' / 'auth.json',
    ]
    for path in candidates:
        if path.exists():
            return json.loads(path.read_text())['token']
    raise SystemExit('no Vercel auth token found — run `vercel login`')


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
        detail = error.read().decode()[:400]
        raise SystemExit(f'{method} {path} -> {error.code}: {detail}')


# ------------------------------------------------------------------ project settings
settings = {
    'gc3-api': {
        'rootDirectory': 'apps/api',
        'framework': None,
        'installCommand': 'cd ../.. && pnpm install --frozen-lockfile',
        'buildCommand': 'cd ../.. && pnpm --filter @gc3/api db:generate',
        'outputDirectory': None,
        'sourceFilesOutsideRootDirectory': True,
    },
    'gc3-portal': {
        'rootDirectory': 'apps/web',
        'framework': 'nextjs',
        'installCommand': 'cd ../.. && pnpm install --frozen-lockfile',
        'buildCommand': 'cd ../.. && pnpm --filter @gc3/web build',
        'outputDirectory': None,
        'sourceFilesOutsideRootDirectory': True,
    },
}

for name, body in settings.items():
    project = call('PATCH', f'/v9/projects/{name}', body)
    print(f'{name}: root={project.get("rootDirectory")} framework={project.get("framework")}')

# ------------------------------------------------------------------ git connection
for name in settings:
    project = call('GET', f'/v9/projects/{name}')
    if project.get('link', {}).get('repo'):
        print(f'{name}: already linked to {project["link"].get("repo")}')
        continue

    linked = call('POST', f'/v9/projects/{name}/link', {'type': 'github', 'repo': 'Jagadeeshz/gc3'})
    print(f'{name}: linked to {linked.get("link", {}).get("repo", "github.com/Jagadeeshz/gc3")}')

# ------------------------------------------------------------------ environment
AUTH_SECRET = secrets.token_urlsafe(48)
WEB_URL = 'https://gc3-portal.vercel.app'
POOLED = os.environ['SUPABASE_DB_URL']

env_by_project = {
    'gc3-api': {
        'SUPABASE_DB_URL': POOLED,
        'AUTH_SECRET': AUTH_SECRET,
        'NODE_ENV': 'production',
        'WEB_ORIGIN': WEB_URL,
        'CORS_ORIGINS': WEB_URL,
        'WEB_APP_URL': WEB_URL,
        'MAIL_FROM': 'GC3 Portal <no-reply@gc3.local>',
        'NOTIFICATION_DRIVER': 'noop',
        'EVENT_QUEUE_DRIVER': 'memory',
        'SLA_SWEEP_INTERVAL_SECONDS': '0',
        'NOTIFICATION_RETRY_INTERVAL_SECONDS': '0',
        'UPLOAD_DIR': '/tmp',
        'API_HOST': '0.0.0.0',
        'API_PORT': '3001',
    },
    'gc3-portal': {
        'NEXT_PUBLIC_API_BASE_URL': 'https://gc3-api.vercel.app/api/v1',
        'API_INTERNAL_BASE_URL': 'https://gc3-api.vercel.app/api/v1',
    },
}

for name, variables in env_by_project.items():
    existing = call('GET', f'/v10/projects/{name}/env')
    have = {item['key'] for item in existing.get('envs', [])}

    for key, value in variables.items():
        if key in have:
            continue
        call('POST', f'/v10/projects/{name}/env',
             {'key': key, 'value': value, 'type': 'encrypted',
              'target': ['production', 'preview', 'development']})
        print(f'{name}: env {key} set')

print('\nconfiguration complete')
