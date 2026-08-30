# Tabby Tally private-beta release and reset runbook

The baseline release is forward-only and does **not** require a remote reset.
Migrations `202608300007_release_readiness.sql` and
`202608300009_private_beta_security_hardening.sql` keep legacy
`public.groups`, `public.user_groups`, and `public.group_invite_links` for one
beta recovery cycle, but remove them from Realtime and revoke browser-role
access. Their removal requires a later, separately approved migration.

The ordered files in `supabase/migrations/` are the only current schema setup.
The root `supabase-schema.sql` and `supabase-auth-migration.sql` filenames are
fail-fast archive pointers and must not be used for setup.

Never run a destructive command until the explicit go/no-go gate in section 9
is complete.

## 1. Operator prerequisites

- Use an operator account authorized for the intended private-beta project.
- Install the repository's Node dependencies and authenticate with
  `npx supabase login`.
- Link and confirm the target:

  ```powershell
  npx supabase link --project-ref <beta-project-ref>
  Get-Content "supabase/.temp/project-ref"
  ```

- Install a Docker-compatible runtime for local Supabase validation. Confirm
  that `docker version` succeeds before `npx supabase start`. A linked dump may
  also invoke the CLI's containerized PostgreSQL tooling. Do not rely on an old
  workstation-specific note about Docker availability.
- Do not put a database password, service-role key, or connection URI in a
  command, transcript, script parameter, or committed file. Let trusted tools
  prompt interactively and keep secrets in the deployment provider.

## 2. Freeze writes and capture exact pre-release evidence

Before inventory or any logical dump, enable the application's maintenance
mode, reject new financial/capture commands, pause outbox and recurring-draft
workers, and confirm active writes have drained. Record who froze writes and
the UTC time in the release ticket. Keep writes frozen through the dump,
migration, and post-deploy smoke test.

In one Supabase SQL editor session, run the exact inventory below. Export the
final result as `exact-row-counts.csv` to encrypted temporary storage. Catalog
estimates are not acceptable.

```sql
create temporary table beta_exact_row_counts (
  schema_name text not null,
  relation_name text not null,
  exact_rows bigint not null
) on commit preserve rows;

do $$
declare
  target record;
  row_count bigint;
begin
  for target in
    select namespace.nspname as schema_name, relation.relname as relation_name
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname in ('public', 'auth', 'storage')
      and relation.relkind in ('r', 'p')
    order by namespace.nspname, relation.relname
  loop
    execute pg_catalog.format(
      'select pg_catalog.count(*) from %I.%I',
      target.schema_name,
      target.relation_name
    ) into row_count;

    insert into beta_exact_row_counts(
      schema_name,
      relation_name,
      exact_rows
    )
    values (target.schema_name, target.relation_name, row_count);
  end loop;
end
$$;

select schema_name, relation_name, exact_rows
from beta_exact_row_counts
order by schema_name, relation_name;
```

```sql
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Also record the current Supabase project ref, migration list, Vercel production
deployment ID, and Git commit SHA in the release ticket.

## 3. Create the backup

First confirm that a provider-managed backup or point-in-time recovery point is
available. This is the primary recovery path for Supabase-managed Auth and
Storage state.

With writes still frozen, create role, schema, and data-only logical dumps.
The script validates the linked project ref, requires the exact inventory,
restricts output to the gitignored repository `backups/` directory, and applies
restrictive filesystem permissions where the host supports them. It does not
accept or print database secrets:

```powershell
.\scripts\Backup-Beta.ps1 `
  -ExpectedProjectRef "<beta-project-ref>" `
  -ExactCountInventoryPath "<encrypted-temp>\exact-row-counts.csv" `
  -WritesFrozen
```

The artifacts, exact inventory, and manifest are written under `backups/`,
which is gitignored. Arbitrary `OutputRoot` locations are rejected. Copy the
entire timestamped directory to encrypted storage outside the working tree.
Do not commit or upload it to an issue or CI artifact. Securely delete the
temporary source inventory after the copy is verified.

## 4. Verify the backup

Run the non-destructive integrity check:

```powershell
.\scripts\Verify-BetaBackup.ps1 `
  -BackupDirectory ".\backups\beta-YYYYMMDDTHHMMSSZ" `
  -ExpectedProjectRef "<beta-project-ref>"
```

Hash verification is necessary but not sufficient. Before a destructive reset:

1. Restore the role, schema, and data dumps to a disposable database or scratch
   Supabase project using the current Supabase backup/restore procedure.
2. Keep outbound email and OAuth callbacks disabled in the scratch project.
3. Run the section 2 exact inventory on the restore target and compare every
   `public`, `auth`, and `storage` table against `exact-row-counts.csv`, except
   `auth.schema_migrations` and `storage.migrations`. Supabase CLI deliberately
   omits those provider-managed migration ledgers from logical data dumps; keep
   their source counts in the inventory, expect zero rows in an isolated
   logical restore, and rely on the provider-managed backup for their recovery.
4. Confirm at least one restored Auth identity can be correlated to
   `public.user_profiles` and `public.participants`.
5. If a legacy table existed, inspect one restored group, its memberships, and
   invite records. Exporting legacy JSON is a recovery aid, not a promise that
   the relational application can import it.
6. Record the restore target, verifier, completion time, and comparison result
   in the release ticket.

Any missing artifact, hash mismatch, restore error, or row-count mismatch
outside those two documented provider-managed migration ledgers is an
automatic **NO-GO**.

## 5. Validate migrations and tests

Start from a clean local database:

```powershell
npx supabase start
npx supabase db reset
npx supabase db lint --fail-on warning
npx supabase test db
```

Then run application gates:

```powershell
npm test
npm run lint
npm run build
```

If local Docker is temporarily unavailable, use the database CI jobs as
additional evidence. The historical-upgrade job reconstructs legacy tables,
policies, grants, Realtime publication membership, profile defaults, and the
old auth trigger before applying migrations 007-009. CI does not replace the
restore rehearsal or operator approval.

## 6. Check Auth, Realtime, and Vercel configuration

Auth:

- Supabase **Site URL** is the production Vercel URL.
- Redirect allow-list includes the production URL, approved preview URL
  patterns, and intentional localhost callback only.
- Each OAuth provider callback points to
  `https://<beta-project-ref>.supabase.co/auth/v1/callback`.
- Anonymous sign-in and signup settings match the private-beta decision.
- Test sign-in, refresh, sign-out, and a rejected unapproved redirect.

Realtime:

- Realtime is enabled for the project.
- The following query returns all six relational financial tables and none of
  the three legacy tables:

  ```sql
  select n.nspname as schema_name, c.relname as relation_name
  from pg_publication as p
  join pg_publication_rel as pr on pr.prpubid = p.oid
  join pg_class as c on c.oid = pr.prrelid
  join pg_namespace as n on n.oid = c.relnamespace
  where p.pubname = 'supabase_realtime'
    and (
      c.relname in (
        'expenses', 'expense_participations', 'payer_contributions',
        'expense_shares', 'settlement_payments', 'settlement_allocations'
      )
      or c.relname in ('groups', 'user_groups', 'group_invite_links')
    )
  order by c.relname;
  ```

Vercel:

- Production and approved Preview environments define
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for the same beta project.
- The frontend has no service-role key, database password, or unprefixed secret.
- Redeploy after an environment change; verify the deployment's effective
  environment without printing values into logs.

## 7. Apply the forward-only baseline

This is the normal, non-reset release path:

```powershell
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

The dry run must show only reviewed pending migrations. Do not use
`--include-seed` in production; `supabase/seed.sql` is an intentional no-op for
deterministic local resets.

After the push, rerun the Realtime query and confirm any existing legacy tables:

- still contain the expected rows;
- have RLS enabled and no policies;
- grant no table privileges to `anon` or `authenticated`;
- remain readable to the operator/service role for recovery.

Confirm migration 010 copied every legacy group, membership, and invite into
`private.legacy_beta_recovery`; invite tokens must be stored only as SHA-256
digests. The archive must grant no access to `anon` or `authenticated`.

Also confirm migration 009 reported no
`anonymous_space_owner_requires_remediation` exception. If it did, stop: an
operator must choose a permanent replacement owner before retrying. Never
silently downgrade or delete an owned Space.

## 8. Post-deploy smoke test

Use two approved beta accounts in separate browser sessions:

1. Sign in and load profile/participant identity.
2. Create and edit a personal expense.
3. Create a direct expense and accept it from the second account.
4. Create a Space expense as an owner/full-access member; confirm a view member
   cannot write.
5. Verify expense headers, participations, contributions, and shares update in
   the second session without refresh.
6. Propose and respond to a settlement; verify payment and allocation updates
   arrive through Realtime.
7. Confirm an unauthenticated request cannot enumerate relational or legacy
   tables.
8. Confirm the prior Vercel deployment is still available for frontend
   rollback.
9. Confirm anonymous accounts cannot accept a full-access Space invite,
   mutate a Space, or propose a Space settlement.
10. Confirm natural-language plus voice capture shares one 100-request monthly
    quota, while OCR remains 20/month and all provider capture remains capped
    at 10 requests/minute.

Stop the release if financial totals, RLS visibility, Auth, or Realtime differ
from expected behavior. After the release owner records a successful smoke
test, reopen writes and resume workers; record the UTC time.

## 9. Explicit destructive reset go/no-go

The operator reset script deletes all Auth users and active relational data. It
preserves the locked legacy group tables and requires their private recovery
archive counts to match before deleting anything. It defaults to **NO-GO**.

All of the following are required for **GO**:

- product owner and database operator approvals are recorded;
- the typed project ref matches the linked project and release ticket;
- a provider recovery point exists, or the product owner explicitly accepts
  its absence for disposable legacy beta data;
- encrypted logical dumps exist;
- hashes pass and the disposable restore plus exact row-count comparison pass;
- Auth identities, Storage objects, policies, and one legacy group were checked;
- migration, pgTAP, lint, and build gates pass;
- Auth, Realtime, and Vercel environment checks pass;
- beta users have been notified and writes are paused;
- rollback owner and recovery window are recorded.

If any item is false or unknown, the decision is **NO-GO** and no destructive
command is run. After a second operator reads the checklist and records GO,
type the expected project ref again, compare it with
`supabase/.temp/project-ref`, inspect `scripts/private-beta-reset.sql`, and only
then run:

```powershell
npx supabase db query --linked --file scripts/private-beta-reset.sql
```

Immediately repeat sections 6 through 8. Preserve the pre-reset backup for the
full beta recovery cycle.

## 10. Rollback and recovery

- For a frontend-only failure, redeploy the previous Vercel deployment.
- For database loss or corruption, pause writes and restore the verified
  provider backup or rehearsed logical dump under the database operator's
  procedure.
- Do not hand-write reverse financial migrations or delete preserved legacy
  tables during incident response.
- Record row-count reconciliation and Auth/Realtime smoke results before
  reopening beta access.
