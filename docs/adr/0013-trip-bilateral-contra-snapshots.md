# Shared Trip bilateral contra snapshots

The existing overview values the remaining original-currency directions at its
frozen quote and takes their bilateral difference. Creator selection previously
listed those directions separately. The new reader reuses the exact canonical
`space_signed_outstanding` query, plus the same per-currency half-up display
valuation. It does not reconstruct original obligations from displayed integers,
screenshot numbers, or a globally minimized Trip graph.

`read_trip_contra_snapshot` returns `edgeBasis: net`, standing and available
capacity separately, original bill/reduction audit, a frozen quote and an opaque
revision. The revision covers shared expense/payment/allocation/member versions
and quote. Current creator/delegates may read shared pairs; ordinary members
receive only their own pairs. Private accounts are absent. Pending ordinary
payments reserve capacity without changing standing or inventing an opposite debt.

All new read helpers use a statement-consistent STABLE snapshot. The native query
is copied without changing its body into a private STABLE helper, leaving the
legacy function untouched. An installer fingerprint verifies both definitions.
Reads acquire no financial write lock. Posting still uses the original common
financial lock and pins the quote rows before rebuilding the snapshot. This
prevents overview polling from interfering with actual payment commands.

New creator/routed drafts explicitly bind the shared revision. Their common
transaction rechecks current roles, original obligations and quote. Capacity
retains the existing VND quote unit; the same snapshot also supplies the user's
MYR (or preferred-currency) display estimate. Actual tender stays integer VND or
MYR. A chosen via amount keeps its original explicit VND reference unit. Cash
aggregation, shared edge reservations, route-before-direct ordering and original
account ownership remain in the existing transaction. A display estimate is not
used as an inverse source of original bill quantities.

Native coverage reuses the existing realized, non-cash contra/repayment mechanism.
Both original directions can be reduced, with metadata distinguishing contra and
repayment equivalents. It never creates intermediary cash. The new resolver
requires **before-valuation minus after-valuation = allocated native quote value**;
pricing only the covered native amount would be wrong when rounding is not
additive. It selects only bounded integer native quantities. Unrepresentable
amounts fail with NATIVE_PRECISION. Two fully paid VND obligations close without
coarse-display rounding leaving artificial VND debt. Cash, coverage, owner-only
private entries, financial history and notification outbox retain atomic posting.

Untagged legacy drafts and frozen plans retain their existing adapter. The old
`routed_edge` definition is unchanged, retaining exact native after-state dependency
checks for old and new whole reversals. The previous public projection is copied
to a private v1 helper without renaming its original OID. Only tagged plans project
remaining estimates through the frozen contra quote. No financial rows are rewritten.

Forward migration: `202611120001_trip_bilateral_contra.sql`. The complete installer
checks the previous 42-version creator baseline and canonical native query, then
verifies all 61 final function bodies/ACLs and the STABLE read/projection contracts.
Repeat installs skip the migration. New UI posting fails closed on unavailable or
inconsistent net reads; capability installation must precede production rollout.
