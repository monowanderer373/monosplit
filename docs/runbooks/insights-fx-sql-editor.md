# Installing the prepared FX metadata in SQL Editor

Use only the existing project `skiqsxvmxvmxfzhrzcxh`:
https://supabase.com/dashboard/project/skiqsxvmxvmxfzhrzcxh/sql/new

The file-preview pane may show only the beginning of a long file. Copying that preview can omit the closing dollar quote and fail before installing anything. Prefer the full raw file:
https://raw.githubusercontent.com/monowanderer373/monosplit/feat/insights-autofx-final/docs/runbooks/insights-fx-production-apply.sql

1. Open the raw file in its own browser tab; select all and copy the entire text, or download the complete file and open it in a plain-text editor. Do not copy an abbreviated file preview or chat excerpt.
2. In a new SQL Editor query, paste the entire content. Its last line must be `-- END OF COMPLETE SCRIPT`. The preceding query contains `FX_INSTALL_COMPLETE`. If those are missing, stop and copy the complete file.
3. Clear any partial text selection and run the entire query. Success returns a row with status `FX_INSTALL_COMPLETE`, schedule and active fields. Share success or the error text only, never credentials.

This applies two additive independent FX metadata migrations and append-only version records in one transaction; it never resets the database or modifies financial facts. Already-applied versions are skipped. One next-minute Cron run restores daily09:10UTC/17:10Malaysia. Codex must still verify the actual provider snapshot and Cron outcome; the success marker alone does not prove provider success or live release.

2026-10-14 recovery: the supplied error42601 ended at `refresh`'s `end $$;`, with no closing outer `$apply$`, second migration, commit or final query. Truncating the complete script reproduces the same unterminated dollar-quote error. The complete file passes PostgreSQL SQL and PL/pgSQL grammar parsing (pglast8.5), and its migration bodies match the frozen isolated-CI-tested files. This is parser validation, not a disposable execution of the full wrapper. Read-only production probe confirmed24 migration records and neither public FX reader installed.
