# Read-only operations checks

`scripts/check-operations.py` provides machine-readable local/staging acceptance for the operational portion of BOL-29. It does not configure a scheduler, send alerts, change application state or contact any endpoint unless explicitly given its URL.

```sh
.venv/bin/python scripts/check-operations.py --url http://127.0.0.1:8799
.venv/bin/python scripts/check-operations.py --url https://your-staging-host.example --timeout 10 --backup /absolute/backups/bol-2026-10-10 --max-backup-age-hours 24
```

Use the service origin, with no path, URL credentials, query or fragment. Remote services require HTTPS; HTTP is supported only for loopback. Redirects are refused, environmental proxies are disabled and responses are limited to 64 KiB. The public health endpoint needs no account secret. JSON output contains fixed check names and actionable reasons; raw response bodies, exception details and endpoint URLs are never included.

Checks cover service status, FFmpeg/ffprobe availability, an attached durable journal, valid queue counters/limits and available admission headroom. Optional backup checks verify the entire offline snapshot's manifest/checksums/SQLite and its manifest modification time against the requested maximum age. Freshness is an operational timestamp check on trusted backup storage, not signed proof of when data was captured. Full verification reads all backup bytes; schedule appropriately for large media stores.

The command writes JSON to stdout and exits **0** for passing checks, **1** for failed checks, or **2** for invalid numeric configuration/command-line syntax. A deployment scheduler should capture output and exit status, retain results under the organization's log policy, and deliver its configured notification when failures persist. Queue saturation can be transient; alert policy should distinguish a brief full queue from sustained unavailability. Backup age limits must match the actual retention/recovery objectives.

No notification destination, alert service, schedule, log retention policy or remote deployment was configured or verified here. A passing health response does not prove real inference accuracy, authenticated account flows, all workers' progress, external storage durability or successful production disaster recovery.

## Local acceptance evidence

`python -m pytest tests/test_operations_check.py -q`: **13 passed**, without external network access. Tests exercise healthy and failing health payloads, missing queue data, saturation, unsafe URLs rejected before any request, credential/error redaction, verified/fresh/stale/corrupt backups, and CLI JSON/nonzero status handling. Combined backup and operations tests: **28 passed**.
