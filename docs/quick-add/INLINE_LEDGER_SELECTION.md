# Inline Quick Add ledger selection

The ledger button replaces the visible Quick Add heading. Its picker exchanges content with the existing category region; amount, calculator, category value, note, date, account and the original split editor remain in place.

Browsing tabs, searching and checking friends are local pending state. The provider commits a target only after re-resolving current permissions and Participant mappings. It preserves entry currency and account identity. Existing cross-currency funding remains pending until its real account debit is supplied; switching never relabels money.

Trip/Group selections create a self-only expense draft in that existing space. Friends confirmation uses an existing Person reference and the existing direct expense scope, prefilling all chosen immutable Participants into the original split editor. It creates no ledger, Group, membership, schema or RPC. The editor still allows equal, exact and item allocation; confirmation itself records no expense.

A real allocation change is explained inside the picker with Keep current / Switch. A nonempty destination draft produces an inline resume/replace choice; the source context draft remains stored. Per-context, per-identity, same-day restoration remains unchanged.

Both sheet and provider pause submission while the picker is open. Closing, retrying and async permission resolution have cancellation guards. The old history context gate remains for unresolved or inaccessible entry targets and existing non-header consumers; the normal ledger button never opens it.

New controls use the approved handoff's scoped tokens, paper texture and icon sprite. The existing lower form geometry and Save & next / Save & close actions are retained. Search does not autofocus. Tabs support arrow/Home/End navigation, friend inputs are native checkboxes, Escape returns focus to the ledger button, and reduced motion suppresses selection animation.

Verification: unit tests cover pending state, service save lock, cancellation, target-draft conflicts, money preservation and direct multi-friend Participants. The disposable Supabase browser suite checks all four actual UI states at 320/360/390/430 CSS px, internal More results, long names, doubled selector text, real direct save/funding, and unchanged Trip membership. Screenshots are generated as CI artifacts, never copied from the design or stored with real user ledger data.
