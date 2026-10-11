# Overlay media credential refresh — BOL-15

Fixed locally on 2026-10-10. Historical audit evidence remains below the resolution note in the original findings.

Placed media now stores an unsigned project/asset route rather than a signed URL. Autosave also normalizes older saved overlay URLs without mutating the open scene. Playback and green-screen editing derive their routes from project and asset IDs. The media URL builder discards old signatures, owner/key parameters and deployment origins before attaching current credentials.

The token cache shares concurrent mint requests, refuses expired credentials, refreshes within fifteen minutes of expiry, and invalidates pending responses when cleared on sign-out. An older pending request cannot restore a signed-out token or erase a newer request. Failed mint requests remain retryable.

The editor checks credentials every minute and when focus or visibility returns. A changed token redraws the overlay canvas and updates cached image/video sources; unchanged credentials do not reload media. Elements wait for authorization before loading. The primary player records its time and playing state before credential replacement and restores them after metadata loads, scoped to the same project and selected asset. A browser refusal to resume playback asks the user to press Play. Existing media URLs remain project-scoped and full access tokens are not placed in URLs.

Verification:

- All 120 Node tests passed, including six new credential/path/cache/autosave tests. Type checking and an isolated production build passed.
- Tests cover old credential removal, token reuse and expiry with a controlled clock, concurrent mint sharing, failed mint retry, sign-out while minting, cached source replacement and unsigned autosave.
- A separate synthetic browser fixture persisted obsolete URLs pointing to old.invalid with expired credentials. The selected primary video, keyed image and rotated video overlay all loaded from current localhost routes. The 0.9-second screenshot is evidence/media-links-preview.png.
- No backend files changed in this batch; the previous 138-test backend result remains applicable. The localhost app remains available for user testing, including the “Media link refresh verification” fixture.

Limits: the localhost browser runs without hosted account authentication. Real Supabase sessions, a two-hour authenticated browser session, browser sleep followed by resume, and primary playback restoration during a live token rotation were not directly replayed. Expiry and sign-out races are covered by controlled unit tests; browser verification covers recovery from obsolete persisted URLs. No production deployment or user project edits were performed.
