# Local media and text-export acceptance — 2026-10-10

This extends the original audit findings 06, 17 and 24 using generated fixtures only. No customer footage, downloaded codecs, model inference or external services were used. No application change was needed for the tested cases.

## Real codec matrix

Every accepted fixture was uploaded through the actual FastAPI asset endpoint in a temporary project. The original-download response was compared byte for byte with the input. The preview response was decoded completely by FFmpeg. Normalized previews were independently probed as H.264 video with AAC audio. Upload reservations were checked for cleanup.

| Input | Expected result | Result |
|---|---|---|
| H.264 + AAC / MP4 | Original bytes served as preview | Passed |
| VP8 + Vorbis / WebM | Original bytes served as preview | Passed |
| VP9 + Opus / WebM | Original bytes served as preview | Passed |
| MPEG-4 Part 2 + PCM / AVI | H.264/AAC preview, original download retained | Passed |
| FFV1 + FLAC / MKV | H.264/AAC preview, original download retained | Passed |
| MJPEG + PCM / MOV | H.264/AAC preview, original download retained | Passed |
| ProRes 4444 alpha / MOV | Explicit 422 rejection; no flattened preview or partial registered asset | Passed |

Existing real ProRes/PCM normalization and duplicate-original preservation tests were also rerun. Existing animated WebP rejection and static alpha PNG preservation tests passed.

The first matrix attempt requested libvorbis, which is absent in the installed FFmpeg build. The final VP8/Vorbis fixture uses the installed native Vorbis encoder with its required experimental opt-in and stereo setting. This was a fixture-generation issue; the passing test still exercises actual Vorbis content.

## Resource boundaries

The entire admission suite was rerun alongside the matrix: **55 Python tests passed**, with two existing dependency deprecation warnings. It covers global and owner upload concurrency, multipart/header bounds, disk headroom, quota reservation, oversized encoder output, a silent encoder killed by the quota watchdog, bounded probe/encoder diagnostic output, partial-file cleanup and failed admission without project mutation. Fixtures use small files and lowered limits rather than exhausting the host.

These establish bounded rejection and cleanup behavior. They do not establish maximum sustainable production throughput, peak process memory under every codec, or a strict zero-overshoot disk cap: sampling watchdogs can exceed the threshold between observations.

## Independent text-export consumers

**Five text-export tests passed**, including two new consumer tests:

- The real generated CSV was read with Python's standard CSV parser. Unicode, embedded commas and quotes, embedded newlines, seven-column shape, start/end times, and intentionally apostrophe-prefixed formula text all round-tripped.
- The real generated WebVTT and SRT were read with FFprobe. All five expected subtitle packets were recovered at their exact cue start times and durations. Existing tests additionally verify literal WebVTT markup escaping and CSV formula-prefix handling.

FFprobe establishes file parsing and timing interoperability, not the visual rendering of every player's WebVTT entities. Python CSV parsing does not certify the formula behavior or import defaults of Excel or Google Sheets. Those named application checks remain pending.

## Evidence and limits

- [Python acceptance output](evidence/media-acceptance-python.txt)
- [Text-export acceptance output](evidence/media-acceptance-text.txt)
- Tests: `tests/test_media_matrix.py`, `tests/export-compatibility.test.ts`

The clips are 0.3–0.4 seconds at 32–64 pixel dimensions; this targets codec/container routing and data preservation. Prior full video-render evidence remains in `evidence/team-final-render-matrix.json`. This new matrix does not render every codec through every browser or export composition, test HDR/high-bit-depth color fidelity, certify variable-frame-rate sync over long clips, or cover every alpha-video codec. ProRes alpha normalization is intentionally unsupported and now verified with a real fixture. Broader device/player acceptance and production load profiling remain open.
