import asyncio
from types import SimpleNamespace
import httpx
import pytest
from fastapi import HTTPException
from server import admin_analytics as analytics
from server.telemetry import scrub_event


def test_admin_uses_verified_identity_not_headers_or_metadata(monkeypatch):
    monkeypatch.setenv('BOL_ADMIN_USER_IDS', 'approved-user')
    spoof = SimpleNamespace(state=SimpleNamespace(), headers={'X-Bol-Owner': 'approved-user'})
    assert not analytics.admin_allowed(spoof)
    with pytest.raises(HTTPException) as failure:
        analytics.require_admin(spoof)
    assert failure.value.status_code == 403
    assert analytics.admin_allowed(SimpleNamespace(state=SimpleNamespace(bol_owner='approved-user')))
    assert not analytics.admin_allowed(SimpleNamespace(state=SimpleNamespace(bol_owner='other-user')))


def test_missing_credentials_are_not_fake_zero_metrics(monkeypatch):
    for name in ('BOL_VERCEL_ANALYTICS_TOKEN', 'BOL_POSTHOG_PERSONAL_API_KEY', 'BOL_SENTRY_READ_TOKEN'):
        monkeypatch.delenv(name, raising=False)
    analytics._cache.clear()
    result = asyncio.run(analytics.overview(7))
    assert len(result['providers']) == 3
    assert all(provider['status'] == 'setup_needed' and provider['metrics'] == {} for provider in result['providers'])
    assert 'TOKEN' not in str(result['links'])


def test_dashboard_links_cannot_leak_credentials_or_target_foreign_hosts():
    assert analytics.safe_link('https://sentry.io/?token=secret', {'sentry.io'}, 'fallback') == 'fallback'
    assert analytics.safe_link('https://sentry.io.evil.test/', {'sentry.io'}, 'fallback') == 'fallback'
    assert analytics.safe_link('https://user:secret@sentry.io/', {'sentry.io'}, 'fallback') == 'fallback'


def test_error_monitoring_removes_private_payloads():
    event = {'user': {'email': 'private'}, 'request': {'headers': {'authorization': 'secret'}}, 'extra': {'captions': 'private'}, 'breadcrumbs': [{'message': 'private'}], 'exception': {'values': [{'value': 'private filename', 'stacktrace': {'frames': [{'vars': {'password': 'secret'}, 'lineno': 12}]}}]}}
    cleaned = scrub_event(event, {})
    assert not any(key in cleaned for key in ('user', 'request', 'extra', 'breadcrumbs'))
    assert 'private' not in str(cleaned) and 'secret' not in str(cleaned)
    assert cleaned['exception']['values'][0]['stacktrace']['frames'][0]['lineno'] == 12


def test_provider_query_is_bounded_and_extracts_metrics(monkeypatch):
    monkeypatch.setenv('BOL_VERCEL_ANALYTICS_TOKEN', 'server-only-secret')
    monkeypatch.setenv('BOL_VERCEL_PROJECT_ID', 'project')
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={'data': [{'deviceType': 'desktop', 'pageviews': 4, 'visitors': 3}]})
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            return await analytics.vercel_summary(client, 7)
    result = asyncio.run(run())
    assert result['metrics'] == {'visitors': 3, 'pageviews': 4}
    assert result['rows'][0]['deviceType'] == 'desktop'
    assert len(calls) == 2 and all(call.url.host == 'api.vercel.com' for call in calls)
    assert 'server-only-secret' not in str(result)


def test_monitoring_failure_cannot_break_worker_error_handling(monkeypatch):
    import sys
    from server import telemetry
    def broken_init(**kwargs):
        raise ValueError('bad configuration')
    monkeypatch.setenv('BOL_SENTRY_DSN', 'invalid')
    monkeypatch.setitem(sys.modules, 'sentry_sdk', SimpleNamespace(init=broken_init))
    monkeypatch.setattr(telemetry, '_monitoring_ready', False)
    assert telemetry.initialize_monitoring() is False
    telemetry.capture_job_error(RuntimeError('private'), 'export')
