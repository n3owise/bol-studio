# Caption reliability — BOL-12, BOL-13, BOL-21

Fixed locally on 2026-10-09. Historical audit evidence is retained.

Joined captions honor the requested word ceiling, capped at seven. The splitter first honors all explicit joins; when that is impossible, it uses a deterministic legal partition that minimizes broken joins. Every word remains exactly once, and explicit forced breaks are preserved. Preview and export already share this page splitter.

Caption size, highlighted size and project vertical position now use bounds shared between the browser and API in src/lib/caption-bounds.json. Linked resizing limits the pair while retaining its proportion, including at the highlighted-size maximum. Font sliders reflect the API limits. Project-wide preview movement stays within 10–90%; individual line overrides retain their separate supported positioning range.

Inline line editing preserves precise raw timestamps separately from rounded display labels. Text corrections retain IDs, recognition originals, timings, confidence, emoji, glossary flags and editorial metadata. Exact token matches anchor insertions and deletions; equal-size replacement spans retain existing records with changed text. Unequal replacement spans receive estimated timing only inside their affected interval. New words inserted between matched words use the available gap. Insertions without sufficient space are rejected with a visible error rather than silently shifting neighboring words. Changing Start or End explicitly scales this line's timing and marks it approximate; neighboring captions remain unchanged. Overlapping explicit timing changes, blank text and malformed time strings are rejected without closing the editor or falsely reporting success. The editor explains when timing is estimated.

Verification:

- 114 Node tests and 120 Python tests passed (234 total). The existing external boot/deployment test remains deselected; the two existing dependency deprecation warnings remain.
- New tests exercise overlong joins for ceilings 1–7 and up to 30 words, deterministic output, precise spelling corrections with metadata, insertions, insufficient gaps, deletions, explicit retiming and extreme linked size ratios. Four API cases verify shared font/hero/position boundary values round-trip.
- One old source-text assertion for linked sizing was replaced with behavioral assertions against the extracted sizing helper.
- Type checking and an isolated production build passed. React review applied the already-used react-best-practices skill; helpers are pure and the edit callback remains scoped to current project state.
- Browser verification used a separate synthetic project. Correcting “Hello wrold” to “Hello world” preserved start/end values 0.123456, 0.31123, 0.447891 and 1.12987 and all checked metadata in the saved JSON. A requested increase at a 40px/200px linked ratio remained 40px/200px, and a 10% position persisted successfully. Evidence: caption-reliability-browser.json and caption-reliability-settings.png.

Limits: the browser smoke test covers a spelling correction and size/position controls; insertion, deletion and retiming cases are verified by tests rather than a full browser matrix. No live ASR/model quality evaluation or deployment was performed. New timing estimates are not forced alignment. Leading/trailing insertions with no free interval require individual word editing or a replacement span with available time. Broader admission limits and caption performance remain separate audit items.

The localhost development servers remain running for user testing. The additional “Caption reliability verification” fixture is available under Projects without replacing the media parity fixture or uploaded user projects.
