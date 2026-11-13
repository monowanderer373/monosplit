# Shared Trip bilateral contra snapshots

The existing overview values the remaining original-currency directions at its
frozen quote and takes their bilateral difference. Creator selection previously
listed those directions separately. The new reader derives its native facts from
`space_signed_outstanding` and uses that same per-currency half-up valuation.
It does not reconstruct obligations from screenshot numbers or globally minimize
the Trip graph.

`read_trip_contra_snapshot` returns `edgeBasis: net`, standing and available
capacity separately, an opaque revision, original bill/reduction audit and the
frozen quote. Pending ordinary payments reserve capacity without changing standing
or creating an opposite debt. Current creator/delegates may read shared pairs;
ordinary members receive only their own pairs. Private accounts are absent.
The revision covers shared expense/payment/allocation/member versions and quote.

New creator/routed drafts explicitly bind that revision. Their common transaction
rechecks current roles, original obligations and quote under the existing financial
lock. The new protocol measures capacity in MYR cents to match the MYR overview;
actual tender remains integer VND or MYR, and a chosen via amount is explicitly MYR.
Route reservations across all recipients precede direct debt. Each original edge
has one shared cap. No reverse raw obligation can authorize a new net payment.

Native coverage uses the existing realized, non-cash contra/repayment mechanism.
Both original directions can be reduced, with metadata distinguishing contra and
repayment equivalents. It never creates cash for an intermediary. The resolver
requires **before-valuation minus after-valuation = allocated net cash value**;
pricing only the covered native amount would be wrong because rounding is not
additive. Unrepresentable amounts fail with NATIVE_PRECISION. Full coverage closes
the original directions. Cash, coverage, owner-authorized private entries, financial
history and notification outbox retain the original atomic posting/reversal path.

Untagged legacy drafts and frozen plans keep the old VND-unit adapter. The old
`routed_edge` definition is unchanged, retaining exact native after-state dependency
checks for both old and new reversals. The previous public projection is copied to
a private v1 helper without renaming its original OID. Only tagged plans project
remaining balances through their frozen contra quote. No rows are rewritten.

Deployment requires forward migration `202611120001_trip_bilateral_contra.sql`.
The complete installer checks the previous 42-version/47-function creator baseline,
then verifies all 60 final function bodies/ACLs; repeat installs skip the migration.
The UI fails closed on unavailable or inconsistent net reads. Old clients remain
supported, but the new UI should be released only after the capability is verified.
