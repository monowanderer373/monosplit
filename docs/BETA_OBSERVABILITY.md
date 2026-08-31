# Beta observability

Tabby Tally uses two separate, privacy-bounded signals:

- Sentry reports frontend crashes and classified auth failures.
- Supabase `product_events` and `financial_events` provide aggregate product
  and command activity.

Neither signal is a financial ledger export. Do not add expense descriptions,
notes, amounts, totals, currencies, participant names/IDs, email addresses,
invite tokens, access/refresh tokens, request bodies, headers, browser storage,
or unrestricted metadata to telemetry.

## Sentry setup

1. Create a Sentry **React** browser project for Tabby Tally.
2. Copy `.env.local.example` to `.env.local`.
3. Set `VITE_SENTRY_DSN` to the project's client DSN. A Vite DSN is a public
   ingest identifier, not a server secret, but it should still be managed as an
   environment value.
4. In Vercel, set the DSN for Production and approved Preview environments.
   `VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA` are converted at build time into
   the Sentry environment and immutable `tabby-tally@<git-sha>` release.
5. Keep `VITE_SENTRY_ENVIRONMENT` and `VITE_SENTRY_RELEASE` only as local or
   emergency overrides. They are not required in Vercel.
6. Redeploy after changing the DSN. Leave it blank to disable reporting.

The client has `sendDefaultPii: false`, no replay integration, and tracing
disabled. Initialization is idempotent and fault-isolated so an SDK setup
failure cannot prevent the application from starting. `beforeSend` constructs
a new event from an allowlist; it does not
forward user, request, context, extra, arbitrary message, or arbitrary tag
fields. Exception values become `Application error`. Stack frames retain only
sanitized asset filename, function, line/column, and in-app state.
`beforeBreadcrumb` drops every breadcrumb except fixed auth lifecycle names,
and strips all breadcrumb data.

In Sentry:

1. Open **Issues**, select the `production` or `preview` environment, and add
   columns for `auth.operation`, `auth.method`, and `auth.failure`.
2. Save an **Auth failures** view filtered by `feature:auth`.
3. Create an issue alert for a new issue or a sharp increase in events where
   `feature = auth`; route it to the beta operator.
4. Review release/environment distribution before treating an increase as a
   product regression.

Expected limitation: reports cannot be traced to a person, account, expense,
invite, request, or exact backend error message. Invalid credentials and other
expected user-correctable auth failures are classified into bounded breadcrumbs
but are not captured as exceptions. Debug unexpected failures with release,
environment, operation, failure class, and sanitized stack location.

## Hosted Supabase auth alignment

`supabase/config.toml` controls local Supabase only. Apply the equivalent hosted
settings in **Authentication → Providers / URL Configuration / Settings**:

1. Enable Google and keep it as the primary sign-in option.
2. Enable email/password signup and require email confirmation.
3. Set minimum password length to 8 and require letters plus digits.
4. Enable anonymous sign-ins. The application invokes anonymous auth only from
   `/space-invite/:token`; personal ledger, Friends, Smart Capture, and friend
   invites still require a permanent account.
5. Set the production Site URL and allow only the production and approved
   preview `/auth/callback` URLs. Keep localhost callback URLs for local testing
   only.
6. Exercise guest-to-email linking on the same browser before beta cutover.
   Confirm the Participant and Space membership remain attached after email
   verification and password creation.

## Read-only product queries

Run these in the Supabase SQL editor with a read-only operator role where
available. Results are aggregate and intentionally omit participant IDs and
metadata payloads.

```sql
-- Product-event volume and success rate by hour.
select
  date_trunc('hour', created_at) as hour,
  event_name,
  coalesce(source, 'none') as source,
  succeeded,
  count(*) as events
from public.product_events
where created_at >= now() - interval '7 days'
group by 1, 2, 3, 4
order by 1 desc, 2, 3, 4;
```

```sql
-- Privacy-safe capture quota failures (metadata values are bounded enums).
select
  date_trunc('day', created_at) as day,
  coalesce(source, 'none') as source,
  coalesce(metadata ->> 'failureReason', 'unknown') as failure_reason,
  count(*) as failures
from public.product_events
where created_at >= now() - interval '30 days'
  and event_name = 'capture_failed'
  and metadata ->> 'failureStage' = 'quota'
group by 1, 2, 3
order by 1 desc, 2, 3;
```

```sql
-- Aggregate quota consumption; no account identifiers or provider costs.
select
  period_month,
  source,
  count(*) as active_accounts,
  sum(usage_count) as captures,
  max(usage_count) as highest_account_usage
from public.capture_usage
where period_month >= date_trunc('month', now())::date - interval '2 months'
group by 1, 2
order by 1 desc, 2;
```

```sql
-- Financial command/audit activity without IDs, safe_diff, or money fields.
select
  date_trunc('hour', created_at) as hour,
  event_type,
  count(*) as events
from public.financial_events
where created_at >= now() - interval '7 days'
group by 1, 2
order by 1 desc, 2;
```

## RLS and log triage

Start with aggregate behavior, then use the Supabase dashboard:

1. In **Logs → Postgres**, filter the beta time window for `42501`,
   `permission denied`, `row-level security`, `P0001`, or the failing RPC name.
2. In **Logs → API**, filter by status (`401`, `403`, `409`, `429`, `500`) and
   route/RPC. Do not copy request bodies, authorization headers, URLs containing
   invite tokens, or response payloads into tickets or Sentry.
3. Confirm deployed policy shape with the read-only catalog query below.
4. Reproduce with a synthetic beta account and record only timestamp, release,
   environment, route template, HTTP status, RPC name, and SQLSTATE.

```sql
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
from pg_catalog.pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Do not query or export `safe_diff`, expense rows, settlement amounts, auth
tokens, profile fields, or participant identifiers for routine dashboard
triage.
