# Tabby Tally beta production hardening

This runbook is the minimum production-reliability baseline for the 8–15 user
private beta. It does not change product behavior, financial rules, or UI.

## 1. Current recovery posture

As checked on 2026-09-01 with `supabase backups list`, the linked project
reported:

- no available physical backup;
- point-in-time recovery disabled;
- WAL-G enabled by the provider.

An enabled backup mechanism is not the same as an available recovery point.
Until the dashboard or CLI lists a physical backup, the encrypted logical
backup in this runbook is the primary independent recovery artifact. Recheck
provider backups monthly and before destructive work. Never run a provider or
logical restore against production as a test.

## 2. Sentry production setup

The browser client accepts only `VITE_SENTRY_DSN`. Vercel automatically injects
`VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA` at build time; Vite converts them to:

- environment: `development`, `preview`, or `production`;
- release: `tabby-tally@<immutable-git-sha>`.

`VITE_SENTRY_ENVIRONMENT` and `VITE_SENTRY_RELEASE` remain local/emergency
overrides. Do not set them in Vercel during normal deployments.

In Vercel:

1. Set `VITE_SENTRY_DSN` for Production and approved Preview environments.
2. Redeploy after the value is added.
3. Confirm a synthetic error appears with the correct environment and release.
4. Confirm the application still loads if the DSN is temporarily invalid.

Source-map upload is intentionally deferred for this beta. Sentry initialization
is fault-isolated and idempotent. Invalid credentials, unconfirmed email, and
weak-password responses remain bounded auth breadcrumbs but are not exception
events. Network, rate-limit, account-conflict, configuration, and unknown auth
failures are reported.

Privacy is a stop-ship requirement. Events must never include expense text,
amounts, currencies, balances, settlement/payment details, OCR/voice content,
names, email addresses, participant or account IDs, invite tokens, auth tokens,
passwords, request bodies/headers, local storage, or arbitrary metadata. Replay,
default PII, tracing, and logs remain disabled.

## 3. One-time backup setup

Installed workstation dependencies:

- Gpg4win / GnuPG for local AES-256 symmetric encryption;
- PowerShell `CredentialManager` module;
- Docker Desktop for PostgreSQL client and isolated restore containers.

Use the Supabase **direct or session-mode** database host. Transaction-mode
poolers are not suitable for `pg_dump`. Run this command interactively and do
not paste either password into chat, source control, command arguments, or a
settings file:

```powershell
.\scripts\Initialize-ProductionBackup.ps1 `
  -ExpectedProjectRef "skiqsxvmxvmxfzhrzcxh" `
  -DatabaseHost "<Supabase direct/session database host>" `
  -DatabaseUser "<database user>"
```

The script:

- detects local OneDrive roots and asks which one to use if several exist;
- stores the database password and archive passphrase in Windows Credential
  Manager;
- stores only non-secret connection metadata in
  `%LOCALAPPDATA%\TabbyTally\Backup\backup-settings.json`;
- writes archives to `OneDrive\Tabby Tally\Production Backups` by default.

OneDrive account passwords are never requested or stored. Ensure the chosen
folder is configured as **Always keep on this device** and that BitLocker or
equivalent device encryption protects local temporary storage. Deleting
plaintext temporary files is best effort; SSD wear leveling prevents a
software secure-delete guarantee.

Store an offline recovery copy of the archive passphrase in a password manager.
Loss of this passphrase makes every encrypted logical backup unusable.

## 4. Daily encrypted backup

Run a first backup manually:

```powershell
.\scripts\Backup-Beta.ps1 -Mode Daily -Force
```

The pipeline is:

1. read secrets from Credential Manager;
2. dump `public`, `auth`, `storage`, and `private` through a Docker PostgreSQL
   client using TLS;
3. capture exact table counts, RLS policy shape, migration state, Git SHA, and
   file hashes;
4. verify the logical dump manifest and table-of-contents;
5. ZIP locally, encrypt with GnuPG AES-256, decrypt it again, compare the ZIP
   hash, expand it, and repeat manifest verification;
6. move only the verified encrypted `.backup.enc` file into OneDrive;
7. remove temporary plaintext and retain 14 daily backups.

Database and archive passwords are sent to tools through standard input, not
command arguments, logs, manifests, or files. Logs contain only stage results
under `%LOCALAPPDATA%\TabbyTally\Backup\Logs`.

### Task Scheduler

Register the task interactively:

```powershell
.\scripts\Register-ProductionBackupTask.ps1
```

Windows prompts for the current account password so Task Scheduler can run
while the user is logged off. The password is passed directly to the Windows
task API, then cleared from the PowerShell variables; it is not written to the
repository, settings, backup logs, or command arguments.

The registered task is named `Tabby Tally Production Backup`:

- principal: current Windows user;
- run whether the user is logged on or not;
- run with least privilege (do not select highest privileges);
- trigger 1: daily at 03:00;
- trigger 2: at log on;
- run as soon as possible after a missed start;
- retry every 30 minutes, 3 times;
- stop after 2 hours;
- allow start on battery and do not stop on battery transition;
- do not wake the computer;
- if already running, do not start a second instance.

Action:

```text
Program: powershell.exe
Arguments: -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "<repo>\scripts\Backup-Beta.ps1" -Mode Daily
Start in: <repo>
```

The daily command is idempotent: if a verified archive already exists for the
local calendar day, the logon trigger only rechecks retention. Docker Desktop
and OneDrive commonly need an interactive user session; a logged-off 03:00
attempt may fail and retry, while the logon trigger performs the catch-up.
OneDrive may upload only after sign-in even if the task successfully wrote the
local synced folder. Confirm the cloud sync status separately.

## 5. Isolated restore rehearsal

Run now, monthly, and before every high-risk migration:

```powershell
$archive = Get-ChildItem `
  "<OneDrive>\Tabby Tally\Production Backups" `
  -Filter "tabby-tally-*.backup.enc" |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First 1

.\scripts\Test-ProductionBackupRestore.ps1 -ArchivePath $archive.FullName
```

The script decrypts into restricted local temporary storage, starts an
unpublished disposable PostgreSQL container, drops only schemas inside that
container, restores the dump, compares every table count, and checks:

- Auth/profile/account-participant correlation;
- Space and membership data;
- expense participant counts;
- payer contributions equal each expense total;
- shares equal each expense total;
- settlement allocations equal each payment total;
- archived legacy invite tokens remain scrubbed.

Production is never connected to by the restore script. A count mismatch or
financial-invariant failure is a failed rehearsal. Reports contain only counts,
check names, hashes, and build metadata under
`%LOCALAPPDATA%\TabbyTally\Backup\Restore Reports`.

## 6. High-risk migration gate

Classify every migration before application:

- **Safely reversible:** additive objects or grants that can be removed without
  rewriting user or financial data.
- **Forward-fix:** constraint, policy, trigger, or function changes where a new
  corrective migration is safer than trying to reverse deployed state.
- **High-risk/destructive:** dropping a table/column/schema, truncating data,
  deleting Auth users, rewriting financial rows, changing minor-unit money
  representation, or changing allocation/settlement algorithms.

Never delete the preserved MonoSplit tables or
`private.legacy_beta_recovery` as part of routine beta hardening.

For high-risk work:

1. freeze writes and drain outbox/workers;
2. record affected tables, row counts, current migration state, owner, approval,
   expected duration, abort conditions, and a tested forward-fix/rollback path;
3. create a fresh backup no more than 60 minutes before migration:

   ```powershell
   .\scripts\Backup-Beta.ps1 -Mode PreMigration -WritesFrozen -Force
   ```

4. restore and verify that exact archive with the section 5 command;
5. run the safety gate:

   ```powershell
   .\scripts\Test-MigrationSafety.ps1 `
     -MigrationPath ".\supabase\migrations\<migration>.sql" `
     -WritesFrozen `
     -RollbackPlanPath "<operator-plan-file>" `
     -ApprovalReference "<issue-or-release-reference>"
   ```

6. apply only after the linked dry-run and local/CI database tests pass;
7. smoke-test financial totals, RLS, Auth, and Realtime before reopening writes.

The gate checks the linked project ref, scans for destructive/financial SQL,
requires a recent encrypted pre-migration backup and matching successful
isolated restore, verifies the archive hash, and runs
`supabase db push --linked --dry-run`. It never applies a migration.

## 7. Remaining beta risks

- Supabase currently lists no provider physical backup and PITR is disabled.
- Daily logical counts can diverge from the dump if writes occur between the
  dump snapshot and inventory query; pre-migration backups eliminate this by
  requiring a write freeze. Restore success and financial invariants remain the
  authoritative daily integrity checks.
- OneDrive sync can lag while the user is logged off; inspect cloud sync status.
- GnuPG symmetric encryption has no recovery without the passphrase.
- Browser source maps are deferred, so stack traces identify bundled locations.
- Restore rehearsals validate PostgreSQL data and policy objects, not Supabase
  provider infrastructure, OAuth provider settings, email delivery, or Storage
  object bytes outside database metadata.

Any failed backup, stale backup, restore mismatch, missing provider recovery
point, or unreviewed high-risk migration is a production **NO-GO**.
