# Priority fixes — 9 October 2026

BOL-01, BOL-02 and BOL-05 are fixed in the local workspace. Existing user changes were preserved. Original audit reports and inventory fingerprints describe the pre-fix baseline. This report records the subsequent changes; it does not close the other 27 findings.

## Export asset containment — BOL-01

Canvas PATCH rejects references absent from the current project's asset manifest. The renderer accepts canonical UUID asset IDs, finds images in that manifest, uses the persisted sourceFile rather than the editable name, and checks canonical paths. Traversal, foreign IDs, file symlinks leaving assets, and symlinked assets directories cannot supply export images. Unsupported or missing images are skipped. Full canvas geometry validation remains part of BOL-17.

## Cancellation and retry — BOL-02

Queued workers capture a persisted transcription generation. Cancellation invalidates it; retry creates a new one. Every start, progress, result, and error update compares the generation under the project lock. A per-project worker lock keeps retry preparation from overlapping the cancelled worker's shared media files and cleanup. Other projects can still run concurrently. Generation fences apply to the current single-server process; distributed worker coordination remains BOL-16. Cancellation during media preparation waits for that media operation to return before the retry starts.

## Revision-aware autosave — BOL-05

The editor sends its revision with every autosave and updates its reference immediately after success. Export polling does not advance the revision behind locally edited fields. When only background metadata changed, autosave compares the remote editable fields with the last saved snapshot and retries once with the current revision. An actual concurrent edit stops the save. Local edits remain in memory; the conflict dialog offers a JSON backup and explicitly labelled discard-and-load recovery. This backup is a preservation artifact, not a new project-import feature.

## Verification

- 103 Node tests passed, including asset containment and revision-save tests.
- 92 backend tests passed, including cancelled-worker results/errors, stale queued generations, shared-media serialization, rejected canvas references, and stale revision rejection.
- TypeScript checking passed.
- Production Vite build passed in an isolated temporary copy.
- Synthetic 720p/30fps export passed; the registered image rendered correctly despite a misleading canvas display name. The decoded center pixel matched the red test image. Browser rendering required the approved local permission escalation.
- The existing deployment-entrypoint gate test was excluded, as in the audit's safe local baseline. No model download or live ASR was run.
- Existing whitespace warnings in unrelated pre-existing changes remain untouched.

Logs are stored in evidence/priority-fixes-*.txt. Browser conflict-dialog interaction has not been tested in this batch.
