# Audio Processing

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

`prepare_media` invokes FFmpeg to map the first audio stream to16kHz mono signed16-bit PCM WAV for recognition. It uses a temporary output followed by replacement. The original/source media remains the export input; recognition audio can be deleted after a successful job and regenerated. This separates analysis needs from exported audio fidelity.

Audio-only browser preview uses AAC at192kbit/s; tests show a stereo44.1kHz source retains those preview characteristics while the ASR copy is mono16kHz. Unsupported video previews are capped to1280 and use CRF28. Remuxing supported media avoids avoidable encoding loss and does not constitute normalization.

Subprocess argument lists mitigate shell metacharacter injection; errors and timeouts are surfaced through run_process. FFmpeg/FFprobe parsing is still an untrusted-media boundary. A fixed temporary output for concurrently requested audio downloads can race; a dedicated per-request file or synchronized cache would be safer. VFR, stream offset, rotation and multi-track synchronization were not exhaustively exercised. The4-second synthetic H.264/AAC fixture uploaded and played successfully.


Source report: [audit chapter](../audit/audio-extraction-analysis.md).

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.

2026-10-10 update: successful vocal isolation supplies all speech engines and companion passes through cleaned samples or a scoped float32 WAV; temporary files are cleaned on all exits. Original audio is retained when separation fails, with recorded signal provenance. See [verification](../audit/isolation-signal-fixes.md).
