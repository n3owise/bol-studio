# Subtitle editor

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

The editor keeps words as the primary editable representation. Groups/pages are rebuilt from words and settings, so per-line position is anchored to the group’s first word rather than a durable line ID. Split/merge decisions are stored in lineBreak; moving words can retime them to keep ordered non-overlapping intervals. Per-word original, spotlight, emphasis and optional emoji/glossary flags influence inspection/rendering.

Undo/redo holds40 local snapshots; there is no server version history. Autosave is serialized within one tab, but there is no conflict protection from another tab unless revision is sent. Drag timing history deserves a pointer regression (BOL-27). Group text replacement can recreate timing and metadata (BOL-21). Inline time fields display tenths while the underlying model has finer precision; display formatting should not become an implicit edit.

Complete source review found a stale closure in Add Caption’s attempt to begin editing groups.length: the pre-insertion group collection can reject that index. Caption-panel local generation/glossary state is initialized from props but needs testing when switching projects without unmounting. Batch casing can produce multiple history entries rather than one atomic operation. These are lower-confidence interaction checks, not claimed runtime failures.

Runtime verified: six fixture words grouped into two visible lines; playback reached4s; name edit autosaved; ? in name opened help; timeline find action opened no UI. Full pointer trimming, all merge/split permutations, long transcript performance and screen-reader operation remain unverified. See BOL-05/09/10/12/13/21/22/27.
