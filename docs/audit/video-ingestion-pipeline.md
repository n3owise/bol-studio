# Video ingestion

Audited 8–9 October 2026 (Asia/Kolkata). Baseline: `d9691b668312dfdc4adc22310698b8b073921b14` plus the pre-existing working-tree changes fingerprinted in [inventory.json](inventory.json). No application source was changed.

The browser accepts video/audio file selection or drag-drop and uses multipart XHR. The editor sets autostart=false so the language question precedes recognition. Other API callers default to autostart=true. Upload progress measures transfer, not inference. There is no chunked or resumable upload protocol or deduplication.

`upload_project` allocates a UUID directory, writes source.bin under a1GiB streamed cap, then inspects media through FFprobe. Filename is reduced to a basename; actual streams/duration drive validation rather than trusting MIME alone. Input must contain audio, duration must exceed the small minimum and not exceed20minutes, and dimensions must be within8192. Corrupt/empty media is rejected and newly created files cleaned. Tests cover invalid media, low mocked limits, audio metadata and cleanup.

Browser-playable inputs are remuxed before the upload response, avoiding mutation underneath an active Range reader. Unsupported preview video codecs use a bounded H.264/AAC preview; audio gets AAC preview where needed. Recognition starts later and should not rewrite the served source. Multiple audio tracks use the first mapped audio stream; there is no track selector.

The multipart parser can spool before the handler’s byte count executes. Secondary assets use a separate extension-driven inspection path and do not inherit all primary media caps. Interrupted connections, upstream body limits, malformed codec variants, disk-full behavior and simultaneous large uploads require bounded staging tests. No claims of password-protected format support or universal codec compatibility are made.
