"""Private, bounded analytics queries. Reporting credentials never reach the client."""
import asyncio
import os
import re
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, Request

_cache: dict[int, tuple[float, dict]] = {}
_lock = asyncio.Lock()


def admin_allowed(request: Request) -> bool:
    # Only middleware-verified JWT identity counts; headers and user metadata do not.
    owner = getattr(request.state, 'bol_owner', '')
    allowed = {value.strip() for value in os.getenv('BOL_ADMIN_USER_IDS', '').split(',') if value.strip()}
    return bool(owner and owner in allowed)


def require_admin(request: Request):
    if not admin_allowed(request):
        raise HTTPException(403, 'Administrator access required.')


def safe_link(value: str, hosts: set[str], fallback: str) -> str:
    url = urlparse(value)
    return value if url.scheme == 'https' and url.hostname in hosts and not url.username and not url.password and not url.query else fallback


def links() -> dict:
    supabase_host = urlparse(os.getenv('BOL_SUPABASE_URL', '')).hostname or ''
    reference = supabase_host.split('.')[0] if supabase_host.endswith('.supabase.co') else ''
    return {
        'vercel': safe_link(os.getenv('BOL_VERCEL_DASHBOARD_URL', ''), {'vercel.com'}, 'https://vercel.com/iamspyderhack-7710s-projects/bol-studio/analytics'),
        'posthog': safe_link(os.getenv('BOL_POSTHOG_DASHBOARD_URL', ''), {'us.posthog.com', 'eu.posthog.com', 'app.posthog.com'}, 'https://us.posthog.com/'),
        'sentry': safe_link(os.getenv('BOL_SENTRY_DASHBOARD_URL', ''), {'sentry.io'}, 'https://sentry.io/'),
        'supabase': f'https://supabase.com/dashboard/project/{reference}' if reference else 'https://supabase.com/dashboard',
    }


async def fetch_json(client, method, url, token, **kwargs):
    import json
    data = bytearray()
    async with client.stream(method, url, headers={'Authorization': f'Bearer {token}'}, **kwargs) as response:
        response.raise_for_status()
        async for chunk in response.aiter_bytes():
            data.extend(chunk)
            if len(data) > 2_000_000:
                raise ValueError('Analytics response too large.')
    return json.loads(data)


def missing(provider, fields):
    return {'provider': provider, 'status': 'setup_needed', 'message': 'Add the reporting credentials to connect this service.', 'missing': fields, 'metrics': {}, 'rows': []}


async def vercel_summary(client, days):
    fields = ['BOL_VERCEL_ANALYTICS_TOKEN', 'BOL_VERCEL_PROJECT_ID']
    absent = [field for field in fields if not os.getenv(field)]
    if absent:
        return missing('vercel', absent)
    now = datetime.now(timezone.utc)
    params = {'projectId': os.environ[fields[1]], 'since': (now - timedelta(days=days)).isoformat(), 'until': now.isoformat(), 'by': '[]', 'limit': '20'}
    if os.getenv('BOL_VERCEL_TEAM_ID'):
        params['teamId'] = os.environ['BOL_VERCEL_TEAM_ID']
    endpoint = 'https://api.vercel.com/v1/query/web-analytics/visits/aggregate'
    total, devices = await asyncio.gather(
        fetch_json(client, 'GET', endpoint, os.environ[fields[0]], params=params),
        fetch_json(client, 'GET', endpoint, os.environ[fields[0]], params={**params, 'by': 'deviceType'}))
    data = total.get('data', {})
    row = data[0] if isinstance(data, list) and data else data if isinstance(data, dict) else {}
    metrics = {key: row[key] for key in ('visitors', 'pageviews') if isinstance(row.get(key), (int, float))}
    rows = [{key: row.get(key) for key in ('deviceType', 'visitors', 'pageviews')} for row in devices.get('data', []) if isinstance(row, dict)] if isinstance(devices.get('data'), list) else []
    return {'provider': 'vercel', 'status': 'connected', 'message': 'Vercel production traffic.', 'metrics': metrics, 'rows': rows}


async def posthog_summary(client, days):
    fields = ['BOL_POSTHOG_PERSONAL_API_KEY', 'BOL_POSTHOG_PROJECT_ID']
    absent = [field for field in fields if not os.getenv(field)]
    if absent:
        return missing('posthog', absent)
    host = os.getenv('BOL_POSTHOG_API_HOST', 'https://us.posthog.com').rstrip('/')
    if host not in {'https://us.posthog.com', 'https://eu.posthog.com', 'https://app.posthog.com'}:
        raise ValueError('Unsupported PostHog API host.')
    project = os.environ[fields[1]]
    if not project.isdigit():
        raise ValueError('Invalid PostHog project ID.')
    url = f'{host}/api/projects/{project}/query/'
    query = f"SELECT event, count() FROM events WHERE timestamp >= now() - INTERVAL {days} DAY AND event IN ('studio_opened','signup_completed','upload_started','upload_completed','upload_failed','captions_started','captions_completed','captions_failed','export_started','export_completed','export_failed') GROUP BY event ORDER BY count() DESC LIMIT 20"
    sessions = f"SELECT count(), avg(duration) FROM (SELECT dateDiff('second', min(timestamp), max(timestamp)) AS duration FROM events WHERE timestamp >= now() - INTERVAL {days} DAY AND properties.$session_id IS NOT NULL GROUP BY properties.$session_id)"
    results, session_results = await asyncio.gather(*[
        fetch_json(client, 'POST', url, os.environ[fields[0]], json={'query': {'kind': 'HogQLQuery', 'query': sql}}) for sql in (query, sessions)])
    rows = [{'event': row[0], 'count': row[1]} for row in results.get('results', []) if len(row) >= 2]
    session = (session_results.get('results') or [[]])[0]
    metrics = {'sessions': session[0], 'average_session_seconds': session[1]} if len(session) >= 2 else {}
    return {'provider': 'posthog', 'status': 'connected', 'message': 'Consented product events and session summaries.', 'metrics': metrics, 'rows': rows}


async def sentry_summary(client, days):
    fields = ['BOL_SENTRY_READ_TOKEN', 'BOL_SENTRY_ORG', 'BOL_SENTRY_PROJECT']
    absent = [field for field in fields if not os.getenv(field)]
    if absent:
        return missing('sentry', absent)
    org, project = [os.environ[field] for field in fields[1:]]
    if not all(re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', value) for value in (org, project)):
        raise ValueError('Invalid Sentry project.')
    issues = await fetch_json(client, 'GET', f'https://sentry.io/api/0/projects/{org}/{project}/issues/', os.environ[fields[0]], params={'query': 'is:unresolved', 'statsPeriod': f'{days}d', 'limit': '20'})
    rows = [{'title': issue.get('title'), 'count': issue.get('count'), 'users': issue.get('userCount'), 'lastSeen': issue.get('lastSeen'), 'url': safe_link(issue.get('permalink', ''), {'sentry.io'}, links()['sentry'])} for issue in issues if isinstance(issue, dict)]
    return {'provider': 'sentry', 'status': 'connected', 'message': 'Up to 20 recent unresolved issues; issue events are not necessarily crashes.', 'metrics': {'unresolved_issues_shown': len(rows)}, 'rows': rows}


async def guarded(provider, call):
    try:
        return await call
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return {'provider': provider, 'status': 'unavailable', 'message': 'Unable to read this service. Check API credentials, permissions and plan access.', 'metrics': {}, 'rows': []}


async def overview(days: int):
    async with _lock:
        cached = _cache.get(days)
        if cached and time.monotonic() - cached[0] < 60:
            return cached[1]
        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
            providers = await asyncio.gather(guarded('vercel', vercel_summary(client, days)), guarded('posthog', posthog_summary(client, days)), guarded('sentry', sentry_summary(client, days)))
        result = {'days': days, 'updatedAt': datetime.now(timezone.utc).isoformat(), 'providers': providers, 'links': links()}
        _cache[days] = (time.monotonic(), result)
        return result
