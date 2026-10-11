# Persistence and ownership

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

There is no application SQL database, ORM, schema migration system or relational index. Supabase stores accounts; this code does not store project metadata in Supabase. Each project occupies `DATA_DIR/<uuid>/` with project.json, source.bin, optional preview, generated analysis audio, assets and exports. Model directories may also be under DATA_DIR but are excluded from user storage accounting.

The Project document contains identity/owner/name/filename/media metadata, created timestamp, status/progress/message, words, settings, waveform, script/language, inference metadata, glossary/options, assets/canvas elements and export entries. A revision is incremented during writes. No persistent transcript version history or distinct source/translation record exists; regeneration replaces words. Per-word original preserves recognized text only within that result, not previous revisions.

`write_project` uses atomic replace; `update_project` rereads under a process-local lock. Optional expected revision rejects409 but the UI omits it. Asset files and JSON metadata are not atomically committed together. Listing scans project directories and reads JSON; malformed/unreadable documents can be skipped. This can hide damaged projects rather than repair them.

Delete removes the whole owned directory, refusing active transcription/export. Queued work checks for deletion before resurrecting state. With auth enabled, unowned legacy projects are inaccessible until explicitly backfilled. `backfill-owner.py` must be used offline because it does not coordinate with the server lock or revisions. No scheduled retention, backups or tested restore policy is present.
