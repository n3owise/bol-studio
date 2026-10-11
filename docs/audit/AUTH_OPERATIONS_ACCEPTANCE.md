# Authentication and operations acceptance

Date: 2026-10-10. Scope: original findings 15 and 29.

## Changes and verified behavior

The JWKS cache retried every request during a cold-start identity-provider outage because an empty cache bypassed the refresh cooldown. The cache now allows its first request immediately, then enforces the same 60-second cooldown whether or not keys have been cached. A recovered provider is retried when the cooldown expires; failure is not cached permanently.

JWT key identifiers must now be nonempty strings before reaching the cache. Malformed identifiers fail authentication rather than raising a dictionary-key type error.

`tests/test_auth_rotation.py` exercises real ES256 signing and verification through an httpx mock HTTP transport. Ten cases passed: concurrent cold-start failures issue one request, retry resumes at the cooldown boundary, recovery succeeds, new signing keys are accepted, retired keys are rejected after a successful refresh, a warm outage retains known keys, unknown keys remain rejected, expired tokens stay expired, issuer/audience/subject checks remain enforced, and malformed identifiers are rejected before fetching. Parameterized malformed identifiers account for five of the ten test cases.

## Configuration inspected without exposing values

The local `.env` contains nonempty `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `BOL_SUPABASE_URL`, and `BOL_MEDIA_SECRET`. Only names and presence were inspected. These values do not establish the availability of a staging deployment or provide an authenticated test-user session. No remote signing keys or account settings were changed.

## Remaining hosted acceptance

Finding 15 is locally strengthened, not fully accepted for hosting. A real test account/session and designated staging deployment are needed to exercise login, access-token expiry and browser refresh, account isolation, protected media refresh, logout, and an intentionally managed signing-key rotation. Cached keys remain usable during provider outages by existing design; this favors availability and cannot prove immediate revocation while the provider is unreachable.

Finding 29 still needs an actual operations destination and deployment policy: alert delivery, retained logs, persistent storage, and scheduled backup/restoration evidence. Local structured diagnostics and recovery tests are useful evidence, but do not verify hosted alert delivery or retention. No external alerts or messages were sent.
