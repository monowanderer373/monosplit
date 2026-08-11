# `GroupRepository` is a thin data-access seam, not a merge-decision authority

`src/lib/groupRepository.ts` extracts the places that talked to the `groups` table directly — `useGroupSync`'s fetch / realtime-subscribe / visibility-refetch / upload, and the read paths inside `useAuth`'s `syncOwnedGroups` / `syncMemberGroups` and `GroupsPage`'s join / delete — behind one `GroupRepository` interface: `fetch`, `fetchMany`, `listOwned`, `save`, `softDelete`, `subscribe`.

## Decision

The repository stays "dumb": it reports and writes rows exactly as given, and never compares versions or decides whether an incoming update should overwrite local state. All last-write-wins bookkeeping (the `version` ref, the "is this update newer" check, `skipNextUpload`) stays in `useGroupSync`, unchanged from before the extraction.

Scope is deliberately narrower than "everything `useAuth.ts` does with Supabase": ownership claim/release/transfer, membership register/update/remove, and invite-link issuance/lookup/acceptance stay as raw Supabase calls in `useAuth.ts`. Those are permission/membership management, a different concern from "read or write the shared group blob." The one-off "legacy recovery" query in `syncOwnedGroups` (groups with `owner_id IS NULL` that the current user is linked to) also stays raw for the same reason — it is a rare migration path, not part of the steady-state sync flow, and forcing it into the repository's permanent interface would turn a one-time patch into a permanent API surface.

## Alternative considered: bake version comparison into the repository

We considered making `subscribe`/`fetch` version-aware (only notify callers on a genuinely newer version), which would have incidentally fixed a real, currently-live bug: `useAuth`'s `hydrateGroupFromAuthSync` path has **no version check at all** — only a "don't clobber the group I'm currently viewing" special case. If a user edits a group while offline and then logs in from a state where that group isn't the active page, `syncOwnedGroups`/`syncMemberGroups` can silently overwrite the newer local edit with a stale remote snapshot.

We rejected fixing this as part of the extraction. Introducing a new seam and changing merge behavior in the same change makes it hard to tell, if something regresses, whether the interface or the behavior change is at fault — and this is sync/auth code, where regressions are expensive to diagnose across devices. The bug is now written down here explicitly; fixing it is a follow-up that touches only `useAuth.ts`'s merge logic, once the extraction itself has proven stable.

## Second adapter: hand-written in-memory, not PGlite

`src/lib/groupRepository.inMemory.ts` (`createInMemoryGroupRepository`) is a map-backed fake, not a PGlite-backed one. The repository interface doesn't own RLS or SQL semantics — those live entirely in Supabase, outside this seam — so a lightweight fake plus contract tests (`groupRepository.test.ts`) is enough to prove `fetch` / `save` / `subscribe` / version bookkeeping / `softDelete` all behave as documented, without adding a WASM Postgres dependency or its setup cost.

## Scope grew during implementation

The architectural review that motivated this extraction only named `useGroupSync.ts`, `useAuth.ts`, and `GroupsPage.tsx`. While migrating those, three more call sites turned up doing the exact same raw Supabase reads: `EmbedPage.tsx` (fetch + realtime subscribe, for the public read-only embed view), `InvitePage.tsx` (fetch, to show the group name before accepting an invite), and `ProfilePage.tsx` (`listOwned`, for the "your groups" list). All three were mechanical swaps to the already-built interface — no new repository methods were needed — so they were folded into this change rather than deferred.

## Consequences

- `useGroupSync.ts`, `useAuth.ts`, and `GroupsPage.tsx` now share one implementation of "talk to the `groups` table"; the three near-duplicate fetch/apply blocks in `useGroupSync` were reduced to one repository call each, with only the version-gating conditional repeated (by design — see above).
- The stale-overwrite bug in `hydrateGroupFromAuthSync` is a known, tracked follow-up, not silently fixed or silently left undocumented.
- Swapping the Supabase adapter for a different backing store (or testing sync logic without a live Supabase project) now only requires implementing `GroupRepository`.
