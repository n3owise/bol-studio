# Encrypted Supabase backups

Enabled 15 October 2026 (India time). First successful production export: GitHub run 38621209293. Role/schema/data export, account-table coverage, encryption, byte-for-byte decryption verification and artifact upload passed. Artifact retention is 30 days. Recovery into an isolated Supabase project remains untested.

The `Encrypted Supabase backup` GitHub workflow runs daily at approximately 02:15 India time when enabled. Only encrypted archives are uploaded as Actions artifacts, with 30-day retention. No database exports are committed to Git. GitHub repository readers may have access to encrypted artifacts; keep the encryption key separately in a password manager and restrict repository access. GitHub may delay schedules or disable them on inactive repositories. Review runs and enable GitHub failure notifications.

## Owner setup

In GitHub repository Settings → Secrets and variables → Actions add:

- Secret `BOL_BACKUP_DATABASE_URL`: the Supabase session-pooler Postgres connection string with the database password. Use session mode, not transaction mode; session pooler supports GitHub runners without IPv6. Keep the password URL-encoded. This is not the Supabase public API URL or anon key.
- Secret `BOL_BACKUP_ENCRYPTION_KEY`: at least 32 cryptographically random characters generated and saved in a password manager. Keep a recoverable offline copy. Losing this key makes backups unusable. Retain old keys for archives made before key rotation.
- Variable `BOL_BACKUP_ENABLED`: `true`, only after the owner approves GitHub as the destination and saves both secrets.

Never paste credentials into chat. Start a manual run under Actions → Encrypted Supabase backup → Run workflow. Download the encrypted artifact, decrypt on a trusted machine, extract into a private directory and run `sha256sum -c SHA256SUMS`. A successful run is export/encryption verification, not a proven restore.

## Coverage and recovery

The archive holds custom roles, application schema including database policies/functions/triggers, and data from `public`, `auth` and `storage`. It explicitly checks that account-table data is present. Additional application schemas need explicit inclusion before claiming coverage. Supabase-managed schema definitions come from the target Supabase project; they are not recreated by the ordinary schema export. The three exports are separate snapshots, so perform recovery validation and use a quiet maintenance period when cross-export consistency is important.

This does not include Storage object bytes, Hugging Face media, environment secrets, OAuth/SMTP configuration or PostHog/Sentry data. Temporary media are deliberately outside this account database backup. Keep service settings documented separately without secrets.

Before declaring recovery ready, restore into an isolated Supabase test project using the official Supabase backup/restore procedure, check account data and application policies, and verify sign-in plus the required app tables. Never test restoration against production. Supabase project encryption keys and managed services can require additional migration steps; inspect current official guidance before restoring. A restore drill has not been performed.

References: https://supabase.com/docs/guides/deployment/ci/backups and https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
