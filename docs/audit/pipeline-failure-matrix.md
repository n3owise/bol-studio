# Pipeline failure matrix

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

| Stage/event | Current response/recovery | Evidence level | Gap / next acceptance check |
|---|---|---|---|
|Empty/corrupt upload|422, new directory removed|Existing executed tests|Fuzz small malformed container fixtures|
|Over byte limit|413 in upload loop|Mock-limit executed test|Upstream pre-spool cap still needed|
|Unsupported/no audio|FFprobe validation refusal|Source and unit paths|Codec/no-audio video fixtures across platforms|
|Network interruption|XHR failure/cancel and notification|Source|Verify cleanup after client disconnect|
|Silence|Empty words/no-speech message; no model load|Executed test|Music/low-level speech not equivalent to silence|
|Cold download failure|Job error/manual retry|Source|Pin revisions and separate preparation state|
|Demucs unavailable/fails|Use original audio|Executed fallback tests|Show whether isolation actually applied|
|Native/translate Sherpa on Linux|Dispatches to unavailable MLX|Dispatch reproduced|Platform capability matrix|
|Translate with Turbo|Unsupported task/model combination|Source and upstream documentation|Bilingual output evaluation|
|Cancel then retry|Old worker can publish stale result|Controlled runtime reproduction|Generation fencing|
|Server restart|Unfinished jobs marked error|Source|Durable restart/retry acceptance|
|Concurrent tabs|Stale whole-project PATCH accepted without revision|Runtime reproduction|Conflict UI and mandatory revision|
|Invalid editor settings|422; dirty state retained|Runtime schema probes|Share control bounds|
|Asset image missing/video decode|Layer silently skipped|Source|Fail export or provide explicit warning|
|Render/process error|Export error/log; user notification|Source plus basic successful export|Child-process cleanup and disk-full fixtures|
|Expired account/token|Refresh or sign-in; media token renewal helpers|Executed auth tests, source UI|Live Supabase expiry flow not tested|
|Delete queued project|Worker notices absence, no resurrection|Executed test|Cancellation/deletion race with active generation|
|Delete active project|409|Executed tests|Keep UI aligned with actual worker completion|

No destructive, load-exhaustion, paid inference or production tests were performed. Failed/untested cases are not reported as passing.
