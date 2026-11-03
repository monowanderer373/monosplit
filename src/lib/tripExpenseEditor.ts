import { validCalendarDay } from "./tripCalendar";
import { supabase } from "./supabase";
import {
  currencyExponent,
  equalMinorShares,
  parseMajorAmount,
  reconcileMinorAmounts,
} from "./money";
import { tripItemMinorShares } from "./tripSplit";
import type { CanonicalExpense } from "../types";
import { expenseEditSnapshot } from "./saveExpenseEdits";
export class TripEditorRejected extends Error {}
export type EditorAudience = "private" | "shared";
export type TripEditorContext = {
  schema_version: 1;
  audience: EditorAudience;
  trip_id: string;
  trip_name: string;
  trip_status: string | null;
  role: string | null;
  can_edit: boolean;
  expense: Record<string, unknown>;
  accounts?: { id: string; name: string; currency: string }[];
  members: {
    id: string;
    name: string;
    kind: "account" | "manual";
    role: string;
  }[];
  settings: {
    consumer_ids: string[];
    split_mode: "equal" | "exact" | "items";
    items: EditorItem[];
  } | null;
  funding: {
    id: string;
    expense_id: string;
    status: string;
    version: number;
    account_id: string | null;
    account_name: string | null;
    account_currency: string | null;
    primary_account_id: string | null;
  }[];
  participations: Record<string, unknown>[];
  contributions: Record<string, unknown>[];
  shares: Record<string, unknown>[];
};
export type EditorItem = {
  id: string;
  name: string;
  amount: string;
  participantIds: string[];
};
export type TripEditorDraft = {
  amount: string;
  note: string;
  category: string;
  date: string;
  consumers: string[];
  paid: Record<string, string>;
  shares: Record<string, string>;
  mode: "equal" | "exact" | "items";
  items: EditorItem[];
  makePrivate: boolean;
  accountChoice?: {
    intent_id: string | null;
    version: number | null;
    account_id: string | null;
    defer?: boolean;
  };
};
export const minorText = (n: number, c: string) => {
  const digits = currencyExponent(c),
    v = BigInt(n),
    f = 10n ** BigInt(digits);
  return `${v / f}${digits ? "." + (v % f).toString().padStart(digits, "0") : ""}`;
};
export const nonnegative = (raw: string, c: string) =>
  /^0+(?:\.0*)?$/.test(raw.trim()) ? 0 : parseMajorAmount(raw, c);
export function initialTripEditorDraft(
  e: CanonicalExpense,
  context: TripEditorContext,
): TripEditorDraft {
  const p = expenseEditSnapshot(e).payload;
  return {
    amount: minorText(e.totalMinor, e.currency),
    note: e.description ?? "",
    category: e.category,
    date: e.occurredOn,
    consumers:
      context.settings?.consumer_ids ??
      p.participantIds.filter((_, i) => p.shareAmounts[i] > 0),
    paid: Object.fromEntries(
      p.participantIds.map((id, i) => [
        id,
        minorText(p.contributionAmounts[i], e.currency),
      ]),
    ),
    shares: Object.fromEntries(
      p.participantIds.map((id, i) => [
        id,
        minorText(p.shareAmounts[i], e.currency),
      ]),
    ),
    mode: context.settings?.split_mode ?? "exact",
    items: context.settings?.items ?? [],
    makePrivate: false,
  };
}
export function tripEditorPayload(e: CanonicalExpense, d: TripEditorDraft) {
  if (!validCalendarDay(d.date)) throw new Error("invalid_expense_date");
  const total = parseMajorAmount(d.amount, e.currency),
    ids = [
      ...new Set([
        ...e.participations
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((p) => p.participantId),
        ...d.consumers,
        ...Object.entries(d.paid)
          .filter(([, raw]) => nonnegative(raw || "0", e.currency) > 0)
          .map(([id]) => id),
      ]),
    ];
  const shares =
    d.mode === "equal"
      ? equalMinorShares(
          total,
          ids.filter((id) => d.consumers.includes(id)),
        )
      : d.mode === "items"
        ? tripItemMinorShares(total, e.currency, d.consumers, d.items)
        : new Map(
            d.consumers.map((id) => [
              id,
              nonnegative(d.shares[id] ?? "", e.currency),
            ]),
          );
  const paid = Object.fromEntries(
    ids.map((id) => [id, nonnegative(d.paid[id] ?? "0", e.currency)]),
  );
  reconcileMinorAmounts(Object.fromEntries(shares), total);
  reconcileMinorAmounts(paid, total);
  if (!d.consumers.length || new Set(d.consumers).size !== d.consumers.length)
    throw new Error("invalid_consumers");
  if (d.makePrivate && tripEditorCandidate(e, d) !== "private")
    throw new Error("invalid_audience");
  return {
    total_minor: total,
    currency_code: e.currency,
    description: d.note.trim() || null,
    category: d.category,
    occurred_on: d.date,
    participant_ids: d.makePrivate ? [e.createdBy] : ids,
    contribution_amounts: d.makePrivate
      ? [paid[e.createdBy] ?? 0]
      : ids.map((id) => paid[id]),
    share_amounts: d.makePrivate
      ? [shares.get(e.createdBy) ?? 0]
      : ids.map((id) => shares.get(id) ?? 0),
  };
}
/** Move one historical consumer's share onto a current member. Payers stay put. */
export function replaceHistoricalConsumer(expense: CanonicalExpense, draft: TripEditorDraft, fromId: string, toId: string): TripEditorDraft {
  if (fromId === toId || !draft.consumers.includes(fromId)) throw new Error('invalid_replacement')
  const paid = { ...draft.paid }
  if (draft.mode === 'items') {
    return {
      ...draft,
      paid,
      consumers: [...new Set(draft.consumers.map(id => id === fromId ? toId : id))],
      items: draft.items.map(item => ({ ...item, participantIds: [...new Set(item.participantIds.map(id => id === fromId ? toId : id))] })),
    }
  }
  if (draft.mode === 'equal' && !draft.consumers.includes(toId)) {
    return { ...draft, paid, consumers: draft.consumers.map(id => id === fromId ? toId : id) }
  }
  const current = tripEditorPayload(expense, draft)
  const shares = new Map<string, number>()
  current.participant_ids.forEach((id, index) => shares.set(id, (shares.get(id) ?? 0) + current.share_amounts[index]))
  shares.set(toId, (shares.get(toId) ?? 0) + (shares.get(fromId) ?? 0))
  shares.delete(fromId)
  const consumers = draft.consumers.filter(id => id !== fromId)
  if (!consumers.includes(toId)) consumers.push(toId)
  return {
    ...draft,
    paid,
    mode: 'exact',
    consumers,
    shares: Object.fromEntries(consumers.map(id => [id, minorText(shares.get(id) ?? 0, expense.currency)])),
  }
}
export function tripEditorCandidate(
  e: CanonicalExpense,
  d: TripEditorDraft,
): EditorAudience | "unresolved" {
  try {
    if (!d.consumers.length) return "unresolved";
    const paid = Object.entries(d.paid)
      .filter(([, raw]) => nonnegative(raw || "0", e.currency) > 0)
      .map(([id]) => id);
    if (!paid.length) return "unresolved";
    return [...d.consumers, ...paid].every((id) => id === e.createdBy)
      ? "private"
      : "shared";
  } catch {
    return "unresolved";
  }
}
export async function loadTripEditor(
  expenseId: string,
): Promise<TripEditorContext> {
  if (!supabase) throw new Error("not_configured");
  const { data, error } = await supabase.rpc("get_trip_expense_editor", {
    target_expense_id: expenseId,
  });
  if (error) throw new Error(error.message);
  if (
    !data ||
    data.schema_version !== 1 ||
    !["private", "shared"].includes(data.audience) ||
    data.expense?.id !== expenseId ||
    !Array.isArray(data.members) ||
    !Array.isArray(data.funding) ||
    typeof data.trip_id !== "string" ||
    typeof data.can_edit !== "boolean" ||
    !Array.isArray(data.participations) ||
    !Array.isArray(data.contributions) ||
    !Array.isArray(data.shares)
  )
    throw new Error("invalid_editor_context");
  return data as TripEditorContext;
}
export async function saveTripEditor(
  requestId: string,
  e: CanonicalExpense,
  c: TripEditorContext,
  d: TripEditorDraft,
) {
  if (!supabase) throw new Error("not_configured");
  const candidate = tripEditorCandidate(e, d),
    audience = c.audience === "shared" && !d.makePrivate ? "shared" : candidate;
  if (audience === "unresolved") throw new Error("invalid_audience");
  const { data, error } = await supabase.rpc("save_trip_expense_editor", {
    request_id: requestId,
    target_expense_id: e.id,
    expected_version: e.version,
    target_trip_id: c.trip_id,
    desired_audience: audience,
    confirm_private: d.makePrivate,
    expense_payload: tripEditorPayload(e, d),
    consumer_ids: d.consumers,
    split_mode: d.mode,
    items: d.items,
    account_choice: d.accountChoice ?? null,
  });
  if (error) {
    if (/^[A-Z0-9]{5}$/.test(error.code ?? ""))
      throw new TripEditorRejected(error.message);
    throw new Error(error.message);
  }
  if (
    !data ||
    typeof data.expense_id !== "string" ||
    !Number.isSafeInteger(data.expense_version)
  )
    throw new Error("invalid_editor_response");
  return data as {
    expense_id: string;
    expense_version: number;
    audience: EditorAudience;
    trip_id: string;
  };
}
/** Red dot only after the live roster is known. Removing a role does not rewrite other bills. */
export function splitNeedsReview(expense: CanonicalExpense, activeMemberIds: ReadonlySet<string> | null) {
  if (!activeMemberIds || expense.scope !== 'space' || expense.status !== 'active') return false
  return expense.shares.some(share => {
    if (share.amountMinor <= 0) return false
    const person = expense.participations.find(row => row.id === share.expenseParticipationId)
    return !!person && !activeMemberIds.has(person.participantId)
  })
}
