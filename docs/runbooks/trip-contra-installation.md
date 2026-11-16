# Contra installation transport

The immutable full installer remains `trip-contra-production-apply.sql` at
16fcbb7d9d9eba1129fde718838a9319dbb6d2a0: 136,448 bytes,
SHA-256 `ae9f32512c617ba993ebae8a794f8acd0db0a5765fe77b6fe6bc7ed4d94329ba`.
The migration and financial application code are unchanged.

## SQL Editor installation

Use the existing project `skiqsxvmxvmxfzhrzcxh` SQL Editor with its normal
installation role. Run the entire **short** `trip-contra-production-bootstrap.sql`
file, including the opening transaction and final result query. It requires the
project's existing `http` and `pgcrypto` extensions in `extensions`; it does not
install extensions, change TLS settings, or require a secret.

The database downloads the public, immutable full installer, checks HTTP status,
exact byte count and SHA-256 before execution, and reuses its entire baseline,
payload, function, privilege and volatility verification inside one transaction.
Only the verified file's two outer transaction statements are removed. Any
download/check/install failure aborts the transaction. A successful result is:

`TABBY_TRIP_CONTRA_INSTALL_COMPLETE_20261112`

Installation adds the capability. It does not register a payment, settle a debt,
reset an account, or rewrite financial rows. Replay verifies the installed state.
After installation, independently check capability and schema, then release the
frontend through the existing GitHub/Vercel path. Installation alone is not proof
of frontend deployment or a private Hanoi balance audit.

## Reported 42601

The November 16 submitted error contains exactly the first 27,083 characters
starting at the full installer's `$contra_install$` delimiter, followed by SQL
Editor metadata. It stops in preflight checks before the migration payload and
closing delimiter. The same prefix reproduces `42601` on isolated PostgreSQL.
Do not append a closing delimiter to that prefix: it would omit the installation.
Use the short, integrity-checked transport instead of copying a long file preview.

## Executable regression

`python3 scripts/verify-trip-contra-installer.py` checks the unchanged canonical
payload and short bootstrap's pinned URL, byte count, digest and wrapper removal.

On a disposable loopback database with the genuine 42-version creator baseline:

```
python3 scripts/test-trip-contra-bootstrap.py --db-url "$LOCAL_DATABASE_URL"
```

The runner accepts only the repository's explicit disposable loopback targets.
It uses real HTTPS and tests the reported truncation, HTTP 404, incomplete body,
digest mismatch, rollback after installation, upgrade and replay. Failure cases
must preserve all application function definitions/ACLs and migration versions.
Every case checks full row hashes and counts across application tables; successful
installation also verifies 43 versions and all 61 function bodies/ACLs. Historical
upgrade CI runs this runner and then replays the original full installer.
