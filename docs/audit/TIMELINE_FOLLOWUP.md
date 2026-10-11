# Timeline playback follow-up — 10 October 2026

Timeline visibility was still scanning every caption group at every playback clock update. Window membership and overview samples now update only after document edits, scrolling, duration or zoom changes. Playback adds the currently active caption through a cached time index and membership set. This preserves first/last overview markers and a maximum of 200 visible groups.

Preview page and word lookup also use cached indexes. Page lookup retains its display start/end boundaries, rather than substituting word boundaries. Page/word ends remain exclusive with first original overlap priority; timeline ends remain inclusive with last original overlap priority. Index construction occurs on document edits. Pathological nested overlaps can still require linear backward scans; other scene/render work remains outside this optimization.

## Verification

- [Frontend tests](evidence/timeline-followup-node.txt): 141 passed, zero failures/skips.
- [Type checking](evidence/timeline-followup-typecheck.txt) and [isolated production build](evidence/timeline-followup-build.txt): exit 0.
- Independent read-only agent review found no actionable regression and confirmed hook order and overlap/boundary behavior.
- [Synthetic 10,000-group profile](evidence/timeline-followup-profile.json): one cached window, 10,000 playback lookups, at most 200 nodes, active caption always retained. This is a helper microbenchmark, not a full browser/device profile.
- Actual two-second synthetic media opened in the running browser; seeking showed the caption overlay and playback advanced from 0.1 to 0.3 seconds with the Pause state and timed video layer visible. [Browser proof](evidence/timeline-followup-browser.png). User projects were not edited.

Real speech quality, hosted authentication/deployment, screen readers, true browser magnification and a full device performance profile remain pending as described in [the overall re-audit](FINAL_REAUDIT.md).
