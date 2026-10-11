# Test coverage gaps

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

Existing Node tests cover grouping, word movement, formatting, settings, chromakey, render contracts and ordered frame delivery. Python tests cover upload/media, interval validation, atomic updates, auth/ownership, cancellation endpoints, model postprocessing and helper contracts. Many recently added UI tests assert source strings/regular expressions; they establish that a label/handler exists, not that a user action works.

The cancellation test did not overlap a running decoder with retry; the added audit probe exposes the race. The translation test asserts the specialist is bypassed but does not check Linux support or whether the selected model translates. The audio-download test checks symbol/label presence and misses authentication. Search button and safe-area command bugs likewise survive source-presence assertions.

Add behavior tests for: two-client save conflict; cancel/retry generation fencing; settings bounds produced by actual controls; signed/expired audio and overlay downloads; Linux engine/task matrix; scene-preview/export parity; twelve-word joined group; literal VTT/CSV text; typed punctuation/native undo; responsive toolbar reachability. Test fallback/error paths without downloading models by injecting decoders and queues.

Reserve a consented corpus for costly quality evaluation and keep its results separate from unit tests. Add property tests for interval invariants and scene membership, golden frames for representative templates and explicit permission-bounded end-to-end staging runs. The root Gradio-import test was intentionally deselected because importing app.py triggers model/system preparation. Refactor those side effects behind explicit startup entry points before making that a default safe test.
