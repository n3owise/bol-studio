# Captioning workflow UX

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

The intended creator journey is upload → choose spoken language/output script and automatic emphasis → generate → listen/correct → choose typography/template → inspect safe areas → export. Upload is a real local/backend operation, not browser-only inference. The post-upload prompt maps common Hinglish/Hindi/English choices to separate language/script fields; that distinction should remain understandable.

The empty editor exposes both Generate Captions and Upload media. The language prompt is deferred until upload finishes and does not autostart from the UI. Progress messages describe extraction/model/transcription stages, but percentage values are staged estimates rather than measured remaining time. First-use downloads can make apparent progress stall; show model preparation separately and let cancellation remain truthful.

Word inspection, group editing, line playback, highlight selection and undo support iterative correction. Hidden hover insert controls and pointer-only movement impede keyboard/touch users. Regeneration replaces the edited transcript; a retained version or explicit recovery affordance would reduce risk. No side-by-side original/translated editing exists.

SRT/VTT/TXT/CSV/JSON are immediate client downloads; MP4 is a worker job with an export snapshot and auto-download. Audio download currently bypasses auth. Explain format limitations and ensure exported media matches preview before promising one-click completion. Priorities: BOL-02/03/04/06/07, then BOL-09/10/18/21.
