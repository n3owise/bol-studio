# UX principles and interaction

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

| Location | Principle/problem | Impact/evidence | Recommendation | Priority |
|---|---|---|---|---|
| Timeline search | Visible controls should perform their named action | Click toggles styling but no search opens, BOL-10 | Open shared find-replace dialog | P2 |
| Palette safe area | Consistent state across entry points | Writes obsolete flag, BOL-11 | One enum-backed control | P2 |
| Cancellation | Status should describe actual work | Ready is shown before worker stops; stale completion reproduced | Cancelling state, generation fence | P1 |
| Generation language | Match capability to user intent | Platform/task dispatch mismatch | Capability-aware choices with explicit unavailable state | P1 |
| Preview/export | WYSIWYG expectations | Caption layer shared, media scene differs | Supported-layer parity or explicit refusal | P1 |
| Text entry | Respect established editing conventions | Question mark opens shortcuts | Scope global shortcuts | P2 |
| Save feedback | Prevent hidden data loss | UI sends no revision, settings can422 | Conflict recovery, shared bounds | P1/P2 |
| New user tour | Accurate guidance | Guarantees and platform labels overstate implementation | Describe approximation and manual review | P3 |

Keep the post-upload language question: it avoids expensive recognition with inherited settings. Preserve specific no-speech feedback, persistent dirty/save state, project search and format choices. Improve recovery before adding more options. Search/sort/filter controls should receive explicit accessible labels, not rely solely on placeholder copy.
