# Technical debt

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

The main controller and stylesheet dominate complexity (4,436 and12,274 lines). State spans Project, refs, separate settings/canvas state and panel-local values. There are overlapping representations rather than one explicit scene/persistence state machine. Extracting modules helps only if invariants and ownership are clarified.

Backend concerns mix API schemas, file persistence, media processing and executor management. One-process locks and queues are intentional local simplifications with scaling limits. Python dependency ranges and model revisions are not reproducibly locked. Multiple runtime entrypoints can drift; the root wrapper has import-time preparation that complicates safe tests.

Existing regression suites mix strong behavioral tests with fragile source-string assertions. Those assertions missed working-looking controls and task selection errors. Replace the most consequential ones with behavior tests, preserving helper tests rather than deleting useful coverage. No coverage-percentage tool was run.

Prioritize boundary failures first: asset containment, job generation, client revision, model/task support and scene export parity. Then reduce duplicate dialogs, stale styles, whole-project polling and unmanaged media caches. Detailed scope/acceptance lives in [KNOWN_BUGS](KNOWN_BUGS.md) and the [five-stage roadmap](../audit/improvement-roadmap.md).

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
