# Recommended improvement roadmap

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

## Stage 1 — Critical reliability

Fix BOL-01 asset containment first, then BOL-02 generation fencing, BOL-03/04 engine-task capability and BOL-05 revision-aware saves. Resolve BOL-06 scene parity or explicitly reject unsupported media layers, and BOL-07 authorized audio download. Restore narrow-screen primary actions (BOL-08). Gate release on targeted security/concurrency regressions plus a small Linux/Mac capability matrix. Estimated engineering scope: roughly2–3 weeks for one engineer, with overlap possible; this is a planning estimate, not a measured delivery guarantee.

## Stage 2 — UI/UX and accessibility

Repair keyboard scopes, find-replace entry, safe-area command and settings bounds (BOL-09/10/11/13/19). Reuse accessible dialogs and expose keyboard insert/move actions (BOL-18). Preserve precision/metadata in text editing and synchronize find counts (BOL-21/22). Validate both themes and all requested widths; include320px and900px in regression checks. Keep the current brand/design direction. Establish a short keyboard-only and screen-reader acceptance checklist.

## Stage 3 — AI pipeline

Feed separated audio consistently (BOL-14), preserve result versions/provenance, pin model revisions and make companion cost/availability visible (BOL-26). Build a consented held-out corpus covering code-switching, noise/music, names, numbers and timing. Translation needs a translation-capable model and bilingual semantic review, not simply a request flag. Avoid publishing accuracy claims until evaluation exists.

## Stage 4 — Architecture and performance

Add quotas/bounded admission, durable jobs with leases, transactional metadata and persistent object storage before scaling beyond one process. Separate render/ASR capacity after measuring memory and queue time. Add stage metrics and privacy-safe diagnostics (BOL-16/17/25/29). Update affected dependencies and lock the deployed environment (BOL-20). Profile before introducing virtualization or a persistent render service; verify restart, duplicate delivery, disk-full and restore behavior.

## Stage 5 — Product evolution

Consider versioned transcripts, reversible translation, richer subtitle interchange, better multi-speaker workflows and explicit export-layer capabilities only after collecting creator feedback. These are opportunities, not confirmed user requirements. Prefer correction-time improvements over adding many new model toggles. Define supported browsers/formats and maintain a small export golden-fixture set.

## Quick wins

Wire timeline search and palette safe-area correctly; scope ? handling; share numeric bounds; persist or reject ignored PATCH fields; escape VTT/CSV; align misleading onboarding copy; update advisory-affected dependencies with regressions. These reduce false affordances without redesign. Do not treat the cancellation/security fixes as mere cosmetic quick wins.

## Sequencing and ownership

Backend owner: asset validation, jobs, auth downloads and quotas. Frontend owner: revision/conflict UX, toolbar reflow, keyboard/dialog behavior and persistence. Media/AI owner: engine capabilities, scene parity, processed audio and quality evaluation. QA owner: executable workflow tests and evidence. No names or staffing commitments are assumed. Each BOL item contains explicit acceptance criteria and an effort estimate; closure requires those checks, not merely changed source strings.
