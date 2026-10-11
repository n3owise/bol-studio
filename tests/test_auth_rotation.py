"""Real JWT verification and async HTTP transport; no hosted account required."""
import asyncio
import json
import time
from types import SimpleNamespace

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from server import auth


def key_pair(kid):
    private = ec.generate_private_key(ec.SECP256R1())
    public = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(private.public_key()))
    public['kid'] = kid
    return private, public


@pytest.fixture
def issuer(monkeypatch):
    state = SimpleNamespace(now=1000.0, calls=0, payload={'keys': []}, status=200)
    real_client = httpx.AsyncClient

    async def serve(request):
        assert request.url == 'https://issuer.test/auth/v1/.well-known/jwks.json'
        state.calls += 1
        return httpx.Response(state.status, json=state.payload)

    monkeypatch.setattr(auth.httpx, 'AsyncClient', lambda **kwargs: real_client(
        transport=httpx.MockTransport(serve), **kwargs))
    monkeypatch.setattr(auth, 'time', SimpleNamespace(monotonic=lambda: state.now))
    monkeypatch.setattr(auth, 'SUPABASE_URL', 'https://issuer.test')
    state.cache = auth.JWKSCache('https://issuer.test/auth/v1/.well-known/jwks.json')
    monkeypatch.setattr(auth, '_cache', state.cache)
    return state


def token(private, kid, **claims):
    return jwt.encode({'sub': 'owner-a', 'aud': 'authenticated',
                       'iss': 'https://issuer.test/auth/v1',
                       'exp': int(time.time()) + 3600, **claims}, private,
                      algorithm='ES256', headers={'kid': kid})


def test_concurrent_cold_outage_is_fail_closed_and_rate_limited(issuer):
    issuer.status = 503

    async def run():
        results = await asyncio.gather(*(issuer.cache.get('missing') for _ in range(20)),
                                       return_exceptions=True)
        assert all(isinstance(result, auth.AuthError) for result in results)
        assert issuer.calls == 1
        issuer.now += auth.REFETCH_INTERVAL_SECONDS
        with pytest.raises(auth.AuthError):
            await issuer.cache.get('missing')
        assert issuer.calls == 2
    asyncio.run(run())


def test_rotation_accepts_new_key_and_removes_retired_key(issuer):
    old, old_public = key_pair('old')
    new, new_public = key_pair('new')
    issuer.payload = {'keys': [old_public]}

    async def run():
        assert await auth.user_id_from(token(old, 'old')) == 'owner-a'
        issuer.payload = {'keys': [new_public]}
        issuer.now += auth.REFETCH_INTERVAL_SECONDS
        assert await auth.user_id_from(token(new, 'new')) == 'owner-a'
        with pytest.raises(auth.AuthError):
            await auth.user_id_from(token(old, 'old'))
        assert issuer.calls == 2
    asyncio.run(run())


def test_warm_outage_preserves_known_key_but_rejects_unknown_and_expired(issuer):
    private, public = key_pair('known')
    issuer.payload = {'keys': [public]}

    async def run():
        assert await auth.user_id_from(token(private, 'known')) == 'owner-a'
        issuer.now += auth.CACHE_TTL_SECONDS + 1
        issuer.status = 503
        assert await auth.user_id_from(token(private, 'known')) == 'owner-a'
        with pytest.raises(auth.AuthError):
            await auth.user_id_from(token(private, 'unknown'))
        with pytest.raises(auth.AuthError) as expired:
            await auth.user_id_from(token(private, 'known', exp=int(time.time())-120))
        assert expired.value.code == auth.EXPIRED
        assert issuer.calls == 2
    asyncio.run(run())


def test_unknown_key_flood_and_bad_claims_do_not_bypass_verification(issuer):
    private, public = key_pair('known')
    issuer.payload = {'keys': [public]}

    async def run():
        assert await auth.user_id_from(token(private, 'known')) == 'owner-a'
        for index in range(20):
            with pytest.raises(auth.AuthError):
                await auth.user_id_from(token(private, str(index)))
        for claims in ({'iss': 'https://wrong.test/auth/v1'}, {'aud': 'anon'}, {'sub': ''}):
            with pytest.raises(auth.AuthError):
                await auth.user_id_from(token(private, 'known', **claims))
        assert issuer.calls == 1
    asyncio.run(run())


@pytest.mark.parametrize('kid', [[], {}, 123, None, ''])
def test_malformed_key_identifier_rejected_before_fetch(issuer, monkeypatch, kid):
    monkeypatch.setattr(auth.jwt, 'get_unverified_header', lambda _: {'kid': kid})
    with pytest.raises(auth.AuthError):
        asyncio.run(auth.user_id_from('malformed'))
    assert issuer.calls == 0


def test_cold_outage_recovers_after_cooldown(issuer):
    private, public = key_pair('recovered')
    issuer.status = 503

    async def run():
        with pytest.raises(auth.AuthError):
            await auth.user_id_from(token(private, 'recovered'))
        issuer.status = 200
        issuer.payload = {'keys': [public]}
        issuer.now += auth.REFETCH_INTERVAL_SECONDS - 1
        with pytest.raises(auth.AuthError):
            await auth.user_id_from(token(private, 'recovered'))
        assert issuer.calls == 1
        issuer.now += 1
        assert await auth.user_id_from(token(private, 'recovered')) == 'owner-a'
        assert issuer.calls == 2
    asyncio.run(run())
