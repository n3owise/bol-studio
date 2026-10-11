# Subtitle and media exports

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

Implemented client formats: SRT, WebVTT, plain TXT, word metadata CSV and project/timing JSON. ASS/SSA, arbitrary target-language subtitles, alpha-channel video and project import interoperability are not established features. SRT uses numbered cues and comma milliseconds; VTT has WEBVTT header and dot milliseconds. UTF-8 Blob downloads preserve Unicode; captions are grouped with shared groupWords.

SRT/VTT lack the visual template, page entrances, font sizes and animation. VTT text is not escaped for cue markup (BOL-24). CSV quotes embedded double quotes but preserves formula-like prefixes and uses1.00 when confidence is absent. File names are sanitized by frontend helpers; audio download is the exception to authorized API URL handling (BOL-07).

MP4 export captures a snapshot with words/settings/media state and accepts burned or green mode,720/1080/2160 resolution and24/25/30/50/60fps. Backend default is60fps, while the tested export dialog chose30fps. Remotion generates transparent captions, Node canvas composites supported image layers, and FFmpeg encodes H.264/AAC. Green mode supplies a chroma backdrop and differs in audio behavior; it is not transparent video.

A4-second synthetic burned720p30fps export completed successfully. That verifies the basic renderer/FFmpeg path, not every template, overlay video, rotation, green output,2160p, long duration or editor import. No Premiere/Resolve/Final Cut compatibility claim was independently tested. Reject missing layer decoding instead of silently returning a partial scene.
