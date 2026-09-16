"""Verifying Supabase access tokens.

The backend does not sign anyone in. Supabase holds the accounts, hashes the
passwords and sends the confirmation and reset mail; all this module does is
prove a token came from our Supabase project and say which user it belongs to.
The answer becomes the `owner` string the project data model has always had —
see the comment above OWNER_HEADER in app.py, which named this seam before it
existed.

Two choices here are worth explaining, because the obvious alternative is worse
in both cases.

**Asymmetric keys, not the shared secret.** Supabase can sign with HS256 using a
secret you hold, or with ES256 against a public key set it publishes. The HS256
secret is the same key that signs service-role tokens, so a copy of it sitting
in a Space environment variable is a copy of full database access. What this
module holds instead verifies signatures and cannot produce them.

**Our own key cache, not PyJWKClient.** PyJWT ships a JWKS client that fetches
with a blocking urllib call. Called from inside an async middleware it stalls
the event loop for the duration of an HTTP round trip to Supabase, and does it
again on every cache miss. httpx is already a dependency and is async.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass

import httpx
import jwt
from jwt import PyJWK

# Unset means no accounts, which is the local default: `npm run dev` needs no
# Supabase project, the same way it needs no API key. Auth switches on by being
# configured rather than by a separate flag that could disagree with it.
SUPABASE_URL = os.getenv("BOL_SUPABASE_URL", "").strip().rstrip("/")
AUTH_ENABLED = bool(SUPABASE_URL)
JWKS_URL = os.getenv("BOL_SUPABASE_JWKS_URL", "").strip() or (
    f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else ""
)

# Supabase signs user tokens with ES256; RS256 is accepted because a project can
# be configured either way. HS256 is deliberately absent and must stay absent:
# a verifier that accepts it will happily treat the *public* key as an HMAC
# secret, so anyone holding the published key — which is to say anyone — can
# mint a token for any user. It is the classic algorithm-confusion hole, and it
# is invisible in testing because every legitimate token still works.
ALGORITHMS = ["ES256", "RS256"]

# Containers drift. A minute is enough for that and short enough that an expired
# token stays expired in any sense that matters.
LEEWAY_SECONDS = 60
CACHE_TTL_SECONDS = 600
# An unknown key id means either a rotation we have not seen or a forged token.
# Refetching answers it, but only at a rate a forger cannot use to make us hammer
# Supabase.
REFETCH_INTERVAL_SECONDS = 60


class AuthError(Exception):
    """A token we will not accept.

    `code` separates the two cases the frontend must treat differently: an
    expired token means refresh and retry, anything else means sign out. The
    message is user-facing and deliberately says nothing about which check
    failed.
    """

    def __init__(self, code: str, detail: str) -> None:
        super().__init__(detail)
        self.code = code
        self.detail = detail


EXPIRED = "token_expired"
UNAUTHENTICATED = "unauthenticated"


@dataclass
class _Keys:
    by_id: dict[str, PyJWK]
    fetched_at: float


class JWKSCache:
    """Supabase's public keys, refetched when they age out or a key is unknown.

    Serves stale keys when a refetch fails. A blip at Supabase should not sign
    every user out, and a key that verified a minute ago is not less trustworthy
    because an unrelated request timed out. With nothing cached at all there is
    nothing to fall back to, so that case fails closed.
    """

    def __init__(self, url: str) -> None:
        self._url = url
        self._keys: _Keys | None = None
        self._last_attempt = 0.0
        self._lock = asyncio.Lock()

    async def get(self, kid: str) -> PyJWK:
        keys = self._keys
        if keys is not None and kid in keys.by_id and time.monotonic() - keys.fetched_at < CACHE_TTL_SECONDS:
            return keys.by_id[kid]
        async with self._lock:
            # Another request may have refreshed while we waited for the lock.
            keys = self._keys
            fresh = keys is not None and time.monotonic() - keys.fetched_at < CACHE_TTL_SECONDS
            if keys is not None and kid in keys.by_id and fresh:
                return keys.by_id[kid]
            if time.monotonic() - self._last_attempt >= REFETCH_INTERVAL_SECONDS or keys is None:
                await self._refetch()
            keys = self._keys
        if keys is None:
            raise AuthError(UNAUTHENTICATED, "Sign-in is unavailable right now. Please try again.")
        if kid not in keys.by_id:
            raise AuthError(UNAUTHENTICATED, "Please sign in to continue.")
        return keys.by_id[kid]

    async def _refetch(self) -> None:
        self._last_attempt = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(self._url)
                response.raise_for_status()
                payload = response.json()
            by_id = {
                key["kid"]: PyJWK.from_dict(key)
                for key in payload.get("keys", [])
                if key.get("kid")
            }
        except Exception:
            # Keep whatever we had. _last_attempt is already set, so a Supabase
            # outage costs one request per minute rather than one per call.
            return
        if by_id:
            self._keys = _Keys(by_id=by_id, fetched_at=time.monotonic())


_cache = JWKSCache(JWKS_URL) if JWKS_URL else None


async def user_id_from(token: str) -> str:
    """The Supabase user id a token belongs to, or raise AuthError.

    The id is the `sub` claim, never the email address. Supabase lets people
    change their email, and every project on disk is keyed by whatever this
    returns — so keying on the email would orphan someone's entire workspace the
    first time they corrected a typo in it.
    """
    if _cache is None:
        raise AuthError(UNAUTHENTICATED, "Please sign in to continue.")
    try:
        header = jwt.get_unverified_header(token)
    except jwt.PyJWTError:
        raise AuthError(UNAUTHENTICATED, "Please sign in to continue.")
    kid = header.get("kid")
    if not kid:
        raise AuthError(UNAUTHENTICATED, "Please sign in to continue.")
    key = await _cache.get(kid)
    try:
        claims = jwt.decode(
            token,
            key.key,
            algorithms=ALGORITHMS,
            audience="authenticated",
            issuer=f"{SUPABASE_URL}/auth/v1",
            leeway=LEEWAY_SECONDS,
            options={"require": ["exp", "sub", "aud", "iss"]},
        )
    except jwt.ExpiredSignatureError:
        raise AuthError(EXPIRED, "Your session expired. Signing you back in.")
    except jwt.PyJWTError:
        raise AuthError(UNAUTHENTICATED, "Please sign in to continue.")
    subject = str(claims.get("sub") or "").strip()
    if not subject:
        raise AuthError(UNAUTHENTICATED, "Please sign in to continue.")
    return subject


# --- Media tokens -------------------------------------------------------------
#
# <video src> and <img src> cannot send headers, so media has always carried its
# credentials in the query string. That was tolerable for the shared API key,
# which ships in the bundle anyway. It is not tolerable for an access token: that
# is a real credential, good for an hour and for everything, and a query string
# ends up in proxy logs, browser history and Referer headers.
#
# So media URLs carry something built for the job instead — a signature over one
# project id, one owner and an expiry. Fifteen minutes, read-only, one project.
# Someone who steals it gets that clip's bytes until it expires and cannot list,
# modify, or discover anything else.

MEDIA_TOKEN_TTL_SECONDS = 900
# Unset is fine for a single-process deployment: it means media URLs minted
# before a restart stop working, and on an ephemeral Space the media they point
# at did not survive the restart either. A multi-worker deployment would have to
# set it, since each worker would otherwise reject the others' tokens.
MEDIA_SECRET = (os.getenv("BOL_MEDIA_SECRET", "").strip() or secrets.token_urlsafe(32)).encode()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def mint_media_token(project_id: str, owner: str) -> str:
    payload = _b64(json.dumps(
        {"p": project_id, "o": owner, "exp": int(time.time()) + MEDIA_TOKEN_TTL_SECONDS},
        separators=(",", ":"),
    ).encode())
    signature = hmac.new(MEDIA_SECRET, payload.encode(), hashlib.sha256).digest()
    return f"{payload}.{_b64(signature)}"


def owner_from_media_token(token: str, project_id: str) -> str:
    """The owner a media token authorises for this project, or "".

    Returns a falsy value for every kind of failure rather than raising: the
    caller's next move is the same either way, and the distinctions are not the
    caller's business.
    """
    payload, _, signature = token.partition(".")
    if not payload or not signature:
        return ""
    expected = hmac.new(MEDIA_SECRET, payload.encode(), hashlib.sha256).digest()
    try:
        if not hmac.compare_digest(_unb64(signature), expected):
            return ""
        claims = json.loads(_unb64(payload))
    except Exception:
        return ""
    # The project is checked as well as the signature. A token is for one clip;
    # without this, any valid token would open every project its owner has.
    if claims.get("p") != project_id or float(claims.get("exp", 0)) < time.time():
        return ""
    return str(claims.get("o") or "")
