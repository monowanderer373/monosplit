import { supabase } from "./supabase";

// Opaque command identity only: never persist the draft, amounts, names or notes.
const key = (actor: string, expense: string) =>
  "tt.trip-editor-command:" + actor + ":" + expense;
export function pendingTripEdit(
  actor: string,
  expense: string,
): { requestId: string; fingerprint: string } | null {
  const raw = sessionStorage.getItem(key(actor, expense));
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (
    typeof value?.requestId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(value.requestId) ||
    typeof value.fingerprint !== "string" ||
    !/^[0-9a-f]{64}$/.test(value.fingerprint)
  )
    throw new Error("invalid_recovery_command");
  return { requestId: value.requestId, fingerprint: value.fingerprint };
}
export async function rememberTripEdit(
  actor: string,
  expense: string,
  requestId: string,
  semanticPayload: unknown,
) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(semanticPayload)),
  );
  const fingerprint = Array.from(new Uint8Array(bytes), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
  sessionStorage.setItem(
    key(actor, expense),
    JSON.stringify({ requestId, fingerprint }),
  );
}
export function forgetTripEdit(actor: string, expense: string) {
  sessionStorage.removeItem(key(actor, expense));
}
export async function reconcileTripEdit(
  requestId: string,
): Promise<"committed" | "not_posted"> {
  if (!supabase) throw new Error("not_configured");
  // Original transactional fence waits for an in-flight command, or retires its
  // UUID so a late HTTP request cannot commit after the user resumes editing.
  const { data, error } = await supabase.rpc(
    "reconcile_personal_money_operation",
    { request_id: requestId },
  );
  if (error) throw error;
  if (!data || !["committed", "not_posted"].includes(data.state))
    throw new Error("invalid_reconciliation");
  return data.state;
}
