import { useEffect, useMemo, useState } from "react";
import type { CanonicalExpense } from "../types";
import { personalExpenseAffiliationRepository } from "../lib/personalExpenseAffiliationRepository";

/** Parent rows already pass canonical personal RLS. Associations never grant access. */
export function useTripPrivateExpenses(
  identity: string,
  self: string,
  trip: string,
  expenses: readonly CanonicalExpense[],
  pending: readonly {
    command: { requestId: string; tripEditor?: { tripId: string } };
  }[] = [],
) {
  const [read, setRead] = useState<{
    key: string;
    ids: string[];
    status: "ready" | "error";
  } | null>(null);
  const key = identity + ":" + self + ":" + trip;
  const revision = expenses
    .filter((e) => e.scope === "personal" && e.createdBy === self)
    .map((e) => e.id + ":" + e.version)
    .join("|");
  useEffect(() => {
    if (!revision) return;
    let current = true,
      sequence = 0;
    const load = () => {
      const request = ++sequence;
      void personalExpenseAffiliationRepository
        .list()
        .then((rows) => {
          if (current && request === sequence)
            setRead({
              key,
              status: "ready",
              ids: rows
                .filter(
                  (r) =>
                    r.ownerParticipantId === self &&
                    r.tripId === trip &&
                    !r.archivedAt,
                )
                .map((r) => r.expenseId),
            });
        })
        .catch(() => {
          if (current && request === sequence)
            setRead({ key, status: "error", ids: [] });
        });
    };
    load();
    window.addEventListener("focus", load);
    window.addEventListener("online", load);
    window.addEventListener("tt:trip-expense-changed", load);
    return () => {
      current = false;
      window.removeEventListener("focus", load);
      window.removeEventListener("online", load);
      window.removeEventListener("tt:trip-expense-changed", load);
    };
  }, [key, revision, self, trip]);
  const result = useMemo(() => {
    const ids = new Set(read?.key === key ? read.ids : []);
    const pendingIds = new Set(
      pending
        .filter((p) => p.command.tripEditor?.tripId === trip)
        .map((p) => p.command.requestId),
    );
    return expenses.filter(
      (e) =>
        e.scope === "personal" &&
        e.createdBy === self &&
        (ids.has(e.id) ||
          (e.id.startsWith("pending:") && pendingIds.has(e.clientRequestId))),
    );
  }, [expenses, key, read, self, pending, trip]);
  return {
    expenses: result,
    status: !revision
      ? ("ready" as const)
      : read?.key === key
        ? read.status
        : ("loading" as const),
  };
}
