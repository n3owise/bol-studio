# Green-screen export performance — 2026-10-12

The previous caption-only green-screen path captured each transparent PNG,
decoded it into a second full-resolution canvas, filled the background, and
copied an RGBA frame to FFmpeg. At 4K that copy is approximately 33 MB per frame.
It also downloaded a browser lazily on the first hosted export.

Caption-only green exports now use Remotion 4.0.534's native H.264 renderer with
lossless shared pixel buffers. The existing caption composition supplies the
green background, dimensions, timing and fonts. Visible placed layers retain
the existing compositor so none disappear. CRF 18, 60 fps when selected, and
full requested dimensions remain unchanged. PNG is the lossless fallback when
the matching browser's shared-memory protocol is unavailable.

Concurrency is bounded: native rendering defaults to two pages on Linux and up
to four on desktop; `BOL_RENDER_CONCURRENCY` accepts 1–4. The compositor uses one
page at 4K. Browser preparation runs before the first hosted export in background.
Startup phases are visible. Five minutes without activity stops the entire
export process group and gives a retry message; the total two-hour cap remains.

Native temporary encoder files and mapped pixel pools live in a private folder
inside the project's storage, count toward storage limits, and are removed in
the worker's final cleanup. File-backed pools also prevent orphaned POSIX shared
memory when a renderer is forcibly stopped.

## Local evidence

Same two-second, captions-only 3840×2160, 60 fps, animated-caption fixture:

| Path | Time |
| --- | ---: |
| Existing compositor, one page | 37.34 s |
| Native renderer, two pages | 31.70 s |
| Native renderer, four pages | 22.38 s |

The four-page result takes about 40% less time than the existing path. Browser
installation is excluded; normal template bundling is included. These are short
local measurements, not a promised minute-long or hosted SLA. The original
overlay fixture was excluded from this comparison because it contains placed
shapes that require the compositor.

Verified 120 frames, two-second duration, 60/1 fps, H.264 silent output, green
background, and matching caption location against the baseline. A separate
2160×3840 Hindi/English test produced all 180 frames at 60/1 fps over three
seconds. The file-backed production configuration was tested separately.

## Further upgrades

For substantially shorter 4K60 waits, benchmark a dedicated render worker with
more CPU and RAM, separate from speech recognition. Tune the bounded worker
count from measured throughput, not logical CPU count alone. Large concurrency
requires separate output/memory budgets. Parallel render chunks or dedicated
GPU rendering/encoding are future architecture work, with output-quality and
timing validation. A hosting-plan or new-service purchase requires an agreed
budget. No paid resources were changed for this fix.
