# Ai Pipeline Architecture

> Current behavior: [operational corrections — 10 October 2026](CURRENT_OPERATIONS.md) supersede implementation statements in this historical audit chapter. Original evidence and baseline line numbers are retained.

Audited 8–9 October2026; baseline `d9691b668312dfdc4adc22310698b8b073921b14` plus existing uncommitted changes. See [source fingerprints](../audit/inventory.json). This describes the audited implementation; update it when behavior changes.

```mermaid
flowchart TD
  Browser[React editor] -->|XHR multipart, autostart false| Gate[Auth and owner middleware]
  Gate --> Upload[UUID directory and source.bin]
  Upload --> Probe[FFprobe stream and limit checks]
  Probe --> Preview[Remux or derived preview]
  Preview --> Choice[Language, script and generation options]
  Choice --> Queue[In-memory shared executor]
  Queue --> WAV[FFmpeg first audio to 16 kHz mono WAV]
  WAV --> Silence{Silent?}
  Silence -->|Yes| Empty[Empty words, no speech message]
  Silence -->|No| Clean[Optional Demucs]
  Clean --> ASR[Sherpa or MLX or faster-whisper]
  ASR --> Text[Normalize, romanize, optional English companion]
  Text --> Glossary[Glossary, energy timing, emphasis, optional emoji]
  Glossary --> JSON[Atomic project JSON update]
  JSON -->|Polling| Browser
  Browser --> Pages[Shared pages and Remotion preview]
  Browser -->|Text download| Subtitles[SRT, VTT, TXT, CSV, JSON]
  Browser -->|Snapshot export job| Node[Node renderer and Remotion frames]
  Node --> FFmpeg[Canvas compositing and FFmpeg encoding]
  FFmpeg --> MP4[Burned or green MP4]
```

Translation changes the ASR task to English audio translation; it is not a downstream text translation box. Frame generation is not AI inference. Optional stages can add a model pass but are sequential dependencies, not independent jobs. The diagram intentionally omits absent LLM generation, database, durable queue and hosted MT API.

Verified runtime path: synthetic4-second video upload → ready project → known fixture words PATCH → browser project open/play/name edit → autosave →720p30fps burned MP4 export completed. This uses seeded captions and therefore does not verify speech recognition. Python 87 and Node 99 tests cover additional contracts. See failure matrix for interrupted paths and evidence/browser-save-export.json for the actual export record.


Source report: [audit chapter](../audit/end-to-end-pipeline.md).

## Maintenance

After a relevant change, update this chapter, the linked API/type contracts and regression evidence. Distinguish source review from executed verification; retain unresolved questions until reproduced. Never store credentials, private transcripts or signed URLs here.
