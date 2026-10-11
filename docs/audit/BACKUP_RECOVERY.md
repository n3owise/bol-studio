# Offline backup and recovery acceptance

The single-process local data store now has an executable backup, verification and restore procedure. This closes the missing local recovery tooling portion of BOL-16 and BOL-29. Hosted storage durability, scheduled retention, off-site copies, alert delivery and a deployment-specific recovery drill remain unverified.

## Operator procedure

Run commands from the Bol repository using its Python environment. Replace the example absolute paths with the actual data directory and backup location. The destination parent must already exist; every backup and restore destination must be a new path.

1. Stop the Bol server gracefully and wait for its workers to finish. Keep the data directory unchanged throughout backup. A running server owns the same exclusive store lock and makes the backup command fail immediately.
2. Create and independently verify a snapshot:

```sh
.venv/bin/python -m server.backup create /absolute/data /absolute/backups/bol-2026-10-10
.venv/bin/python -m server.backup verify /absolute/backups/bol-2026-10-10
```

3. Restart the original server after backup. Copy the verified snapshot to the organization's protected off-site storage under the same confidentiality controls as the original media and transcripts. Configure retention and an alert on a nonzero command exit in the deployment's scheduler; no scheduler, notification destination or external storage is configured by this change.
4. For recovery, stop the server, verify the selected snapshot, and restore to a new directory:

```sh
.venv/bin/python -m server.backup restore /absolute/backups/bol-2026-10-10 /absolute/restored-data
```

5. Point `DATA_DIR` at that restored directory, then start exactly one server process using the normal application configuration. Keep the original data directory intact until recovery is accepted. Verify project access, source media playback, an export and queued-work recovery before switching users to the restored service.

Snapshots preserve every regular data file, including private export snapshots, plus a consistent SQLite job journal. SQLite's backup API consolidates committed WAL content; process locks and SQLite transient sidecars are omitted. Restored pending/running work remains available for the application's existing replay and generation checks. Replay is not an exactly-once execution guarantee.

Each snapshot contains a versioned size/SHA-256 manifest. Verification rejects missing and unexpected files, altered bytes, traversal paths, symlinks, special files and corrupt SQLite. Restore copies into a private staging directory, checks copied bytes again, and publishes it atomically using the operating system's no-replacement rename. Existing paths cannot be overwritten, including a destination created concurrently. Files and directories are synced before publication. Failed pre-publication operations remove their staging directory. A machine crash can leave a hidden `.bol-backup-*` or `.bol-restore-*` staging directory; it is not a completed snapshot and should never be used as one.

Snapshots contain sensitive application data and are not encrypted by this tool. Their root directory is created with mode 0700. The checksum manifest detects corruption, not a malicious party able to replace both the manifest and files. Store verified backups in trusted, access-controlled storage; do not modify a source snapshot while restoring it. The lock coordinates Bol processes, not arbitrary external programs writing directly to files. macOS and Linux are supported; other operating systems fail safely instead of publishing without atomic no-replacement support. Model weights, environment secrets, application code and external services are outside `DATA_DIR` and require separate recovery arrangements.

## Executed local acceptance

`python -m pytest tests/test_backup.py -q`: **19 passed**.

Coverage includes byte-for-byte media restoration; a running journal entry restored and actually replayed once through `BoundedExecutor`; successful job removal after replay; active server lock refusal; corruption, missing-file, unexpected-file, traversal, absolute-path and symlink rejection; existing-destination refusal for both operations; a racing destination rejected by the kernel; corrupt SQLite despite an updated matching hash; consolidation of committed SQLite WAL content; and refusal of unreadable source subtrees instead of silently publishing incomplete media.

This is a temporary-directory recovery drill, not evidence of cloud volume persistence, real hosted account recovery, production recovery time/objectives, retention compliance or operational alerting.

Final follow-up also rejects non-object manifest JSON cleanly before restore; four malformed-manifest cases passed. See [acceptance follow-up](ACCEPTANCE_FOLLOWUP.md).
