# Open questions and verification limits

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

1. Is the production worker currently launched through Docker Uvicorn or root Gradio app.py, and is its DATA_DIR on a persistent volume? No production access was used.
2. Which engine/model revisions are supported for native Hindi and translation on each deployment platform? Dispatch defects are documented; real quality remains unevaluated.
3. Must scene video overlays, primary media switching and chromakey be exportable now, or should unsupported actions be withheld? Current preview promises exceed export paths.
4. What retention, storage quota, backup and deletion policy should apply to uploaded media, snapshots and logs?
5. Which browser engines, mobile sizes, subtitle editors and assistive technologies are release targets? Only one in-app browser was exercised.
6. Should joining a caption override the seven-word cap? Current behavior violates the documented ceiling without an explicit policy.
7. Is translation intended to replace the transcript or preserve editable source and target versions? Current behavior replaces it.
8. What correction-time/semantic/timing thresholds define acceptable ASR/translation? No consented held-out corpus or calibrated confidence target was supplied.
9. Are multi-process/multi-host deployments planned? Current locks, queue and signing-secret defaults are not enough.
10. What telemetry can be retained without exposing transcripts, signed media URLs or credentials?

Unverified: live Supabase signup/reset/expiry, actual production CORS/storage isolation, fresh model inference, noisy/overlapping multilingual accuracy, full cross-account export exploit, all media overlay variants,4K/long/green exports, disk exhaustion, server restart recovery, a second browser engine and full WCAG 2.2AA conformance. These are concrete limits, not claims that those scenarios work.

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
