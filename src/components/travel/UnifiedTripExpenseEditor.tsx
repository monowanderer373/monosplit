import { createPortal } from "react-dom";
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { CanonicalExpense } from "../../types";
import { usePersonalLedger } from "../../hooks/usePersonalLedger";
import { useSettlements } from "../../hooks/useSettlements";
import {
  tripAuthoritativeExpenses,
  tripCurrentPayments,
} from "../../lib/tripLedger";
import QuickIcon from "../QuickIcon";
import AmountInput from "../AmountInput";
import { useAuth } from "../../hooks/useAuth";
import { useAccessibleDialog } from "../../hooks/useAccessibleDialog";
import { useStore } from "../../store/useStore";
import { useT, categoryKey, friendlyErrorKey } from "../../lib/i18n";
import {
  TripEditorRejected,
  loadTripEditor,
  initialTripEditorDraft,
  tripEditorPayload,
  tripEditorCandidate,
  saveTripEditor,
  minorText,
  nonnegative,
  type TripEditorContext,
  type TripEditorDraft,
} from "../../lib/tripExpenseEditor";
import {
  ledgerRepository,
  mapExpenseRow,
  type ExpenseRow,
} from "../../lib/ledgerRepository";
import {
  formatMinorAmount,
  parseMajorAmount,
  reconcileMinorAmounts,
} from "../../lib/money";
import { localeForLang } from "../../lib/locale";
import { generateId } from "../../lib/id";
import { groupAmount } from "../../lib/amountDisplay";
import { SELECTABLE_EXPENSE_CATEGORIES } from "../../lib/categories";
import { deriveRelationalDebtLines } from "../../lib/relationalBalance";
import { QuickItems } from "../SplitConfiguration";
import { TravelIcon } from "./TravelUI";
import {
  pendingTripEdit,
  rememberTripEdit,
  forgetTripEdit,
  reconcileTripEdit,
} from "../../lib/tripEditorRecovery";
import "./unified-expense-editor.css";

type Props = {
  tripId?: string;
  expense: CanonicalExpense;
  trigger: ReactNode;
  triggerClassName?: string;
  onRefresh: () => Promise<unknown>;
  statusNotice?: string;
  viewOnly?: boolean;
};
export default function UnifiedTripExpenseAction(props: Props) {
  const hidden = useStore((s) => s.homeUi.balanceHidden),
    lang = useStore((s) => s.lang);
  const [open, setOpen] = useState(false),
    location = useLocation(),
    navigate = useNavigate(),
    { authUser } = useAuth(),
    key = "trip-expense-editor:" + props.expense.id;
  return (
    <>
      <button
        type="button"
        className={props.triggerClassName ?? "tl-record-trigger"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          hidden
            ? lang === "zh"
              ? "打开记录"
              : "Open record"
            : (props.viewOnly
                ? lang === "zh"
                  ? "查看 "
                  : "View "
                : lang === "zh"
                  ? "编辑 "
                  : "Edit ") + (props.expense.description ?? "")
        }
        onClick={() => {
          setOpen(true);
          navigate(location.pathname + location.search, {
            state: {
              ...location.state,
              routeOverlay: key,
              restoreScroll: window.scrollY,
            },
          });
        }}
      >
        {props.trigger}
      </button>
      {open ? (
        <UnifiedTripExpenseEditor
          key={(authUser?.id ?? "") + ":" + props.expense.id}
          {...props}
          overlayKey={key}
          onExit={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
export function UnifiedTripExpensePortal(
  props: Props & { onExit: () => void },
) {
  const location = useLocation(),
    navigate = useNavigate(),
    [origin] = useState(() => location),
    [originScroll] = useState(() => window.scrollY),
    [armed, setArmed] = useState(false),
    started = useRef(false),
    key = "trip-expense-editor:" + props.expense.id;
  useLayoutEffect(() => {
    if (started.current) return;
    started.current = true;
    navigate(origin.pathname + origin.search, {
      state: {
        ...origin.state,
        routeOverlay: key,
        restoreScroll: originScroll,
      },
    });
  }, [key, origin, originScroll, navigate]);
  // Wait for the router to commit the overlay entry before mounting its Back
  // guard; retain the mounted draft when that entry is subsequently popped.
  const active = location.state?.routeOverlay === key;
  if (active && !armed) setArmed(true);
  return active || armed ? (
    <UnifiedTripExpenseEditor {...props} overlayKey={key} />
  ) : null;
}
export function RestoredTripExpenseEditor({expenseId,onExit}:{expenseId:string;onExit:()=>void}){
 const ledger=usePersonalLedger();
 return <UnifiedTripExpenseEditor expense={{id:expenseId}} trigger={null} onRefresh={ledger.refresh} onExit={onExit} overlayKey={'trip-expense-editor:'+expenseId}/>;
}
function UnifiedTripExpenseEditor({
  expense,
  tripId,
  onRefresh,
  statusNotice,
  overlayKey,
  onExit,
}: Omit<Props,"expense"> & {expense:Pick<CanonicalExpense,"id">&Partial<Pick<CanonicalExpense,"version"|"description">>;overlayKey:string;onExit:()=>void}) {
  const t = useT(),
    lang = useStore((s) => s.lang),
    hidden = useStore((s) => s.homeUi.balanceHidden),
    zh = lang === "zh",
    copy = (en: string, cn: string) => (zh ? cn : en),
    { authUser } = useAuth(),
    self = authUser?.participantId ?? "",
    navigate = useNavigate(),
    location = useLocation();
  const describeFailure = (cause: unknown) => {
    const code = cause instanceof Error ? cause.message : "";
    if (code === "audience_transition_has_dependencies")
      return copy(
        "This expense cannot be made private while shared obligations, payment requests or settlement history depend on it. Keep it shared to continue editing.",
        "此费用仍有关联的共享义务、收付款请求或结算历史，暂不能转为私人。请选择保留共享继续编辑。",
      );
    if (code === "posted_funding_immutable")
      return copy(
        "This deduction is already posted. Its account history cannot be replaced here.",
        "这笔扣款已经入账，不能在这里替换原账户历史。",
      );
    if (code === "split_metadata_mismatch" || code === "invalid_consumers")
      return copy(
        "Review the selected consumers and split amounts before saving.",
        "保存前请核对消费对象和分摊金额。",
      );
    return t(friendlyErrorKey(cause));
  };
  const [context, setContext] = useState<TripEditorContext | null>(null),
    [original, setOriginal] = useState<CanonicalExpense | null>(null),
    [draft, setDraft] = useState<TripEditorDraft | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0),
    [focused, setFocused] = useState(false),
    [expanded, setExpanded] = useState(false),
    [payerOpen, setPayerOpen] = useState(false),
    [guard, setGuard] = useState<
      "discard" | "reload" | "cancel" | "private" | null
    >(null),
    [busy, setBusy] = useState(false),
    [unknown, setUnknown] = useState(false),
    [committed, setCommitted] = useState(false),
    [conflict, setConflict] = useState(false);
  const changeGuard = (value: typeof guard) => {
    if (value) setFocused(false);
    setGuard(value);
  };
  const ledger = usePersonalLedger(),
    settlementRead = useSettlements(
      !!context,
      self + ":" + (context?.trip_id ?? ""),
    );
  const baseline = useRef(""),
    inflight = useRef(false),
    attempt = useRef<{ key: string; id: string } | null>(null),
    closing = useRef(false),
    savedExpenseId = useRef<string | null>(null),
    amountRef = useRef<HTMLInputElement>(null),
    bodyRef = useRef<HTMLDivElement>(null);
  const dirty = !!draft && JSON.stringify(draft) !== baseline.current,
    editable = !!context?.can_edit && !busy && !unknown && !guard && !committed;
  const close = (popped = false) => {
    if (inflight.current || closing.current) return;
    closing.current = true;
    if (!popped && window.history.state?.usr?.routeOverlay === overlayKey)
      navigate(-1);
    onExit();
  };
  const requestClose = () => {
    if (inflight.current || unknown) return;
    if (!committed && dirty) {
      changeGuard("discard");
      return;
    }
    close();
  };
  const dialog = useAccessibleDialog<HTMLElement>(requestClose);
  const focusError = () =>
    requestAnimationFrame(() =>
      bodyRef.current
        ?.querySelector<HTMLElement>("[aria-invalid=true]")
        ?.focus(),
    );
  const describeLoadError = useEffectEvent((cause: unknown) =>
    t(friendlyErrorKey(cause)),
  );
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    void loadTripEditor(expense.id)
      .then((c) => {
        if (!live) return;
        if (tripId && c.trip_id !== tripId)
          throw new Error("invalid_editor_context");
        const e = mapExpenseRow({
            ...c.expense,
            participations: c.participations,
            payer_contributions: c.contributions,
            expense_shares: c.shares,
          } as unknown as ExpenseRow),
          d = initialTripEditorDraft(e, c);
        setContext(c);
        setOriginal(e);
        setConflict(false);
        setDraft(d);
        baseline.current = JSON.stringify(d);
        setExpanded(c.audience === "shared");
      })
      .catch((c) => {
        if (live) setError(describeLoadError(c));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [expense.id, retry, tripId]);
  useLayoutEffect(() => {
    const previous = document.body.dataset.tripExpenseEditor,
      overflow = document.body.style.overflow;
    document.body.dataset.tripExpenseEditor = "open";
    document.body.style.overflow = "hidden";
    const update = () => {
      const v = window.visualViewport;
      if (dialog.current && v) {
        dialog.current.style.height = v.height + "px";
        dialog.current.style.top = v.offsetTop + "px";
        requestAnimationFrame(() => {
          const active = document.activeElement;
          if (
            active instanceof HTMLElement &&
            bodyRef.current?.contains(active)
          )
            active.scrollIntoView({ block: "nearest", inline: "nearest" });
        });
      }
    };
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      if (previous) document.body.dataset.tripExpenseEditor = previous;
      else delete document.body.dataset.tripExpenseEditor;
      document.body.style.overflow = overflow;
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [dialog]);
  const handleRouteChange = useEffectEvent(() => {
    if (closing.current) return;
    if (
      location.state?.routeOverlay === overlayKey ||
      window.history.state?.usr?.routeOverlay === overlayKey
    )
      return;
    if (dirty || inflight.current || unknown) {
      navigate(location.pathname + location.search, {
        state: { ...location.state, routeOverlay: overlayKey },
      });
      if (!inflight.current && !unknown) changeGuard("discard");
    } else close(true);
  });
  useEffect(() => {
    handleRouteChange();
  }, [location.key, location.state, overlayKey, dirty, unknown]);
  useEffect(() => {
    if (!dirty && !unknown) return;
    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty, unknown]);
  const refreshAuthority = useEffectEvent((c: TripEditorContext) => {
    if (original && c.expense.version !== original.version) setConflict(true);
    setContext((old) =>
      old
        ? { ...old, can_edit: c.can_edit, role: c.role, members: c.members }
        : c,
    );
  });
  const detectVersion = useEffectEvent(() => {
    if (original && expense.version!==undefined && expense.version > original.version) setConflict(true);
  });
  useEffect(() => {
    detectVersion();
  }, [expense.version, original?.version]);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      void loadTripEditor(expense.id)
        .then((c) => {
          if (live) refreshAuthority(c);
        })
        .catch(() => {
          if (live)
            setContext((old) => (old ? { ...old, can_edit: false } : old));
        });
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      live = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [expense.id]);
  const patch = (next: Partial<TripEditorDraft>) => {
    if (!editable) return;
    const clearsAccount =
      !!next.paid && /^0+(?:\.0*)?$/.test(next.paid[self] ?? "0");
    setDraft((old) =>
      old
        ? {
            ...old,
            ...next,
            ...(clearsAccount ? { accountChoice: undefined } : {}),
            ...("consumers" in next || "paid" in next
              ? { makePrivate: false }
              : {}),
          }
        : old,
    );
    setError("");
  };
  const candidate =
      original && draft ? tripEditorCandidate(original, draft) : "unresolved",
    audience = context?.audience === "shared" ? "shared" : candidate;
  const people =
    context && original
      ? [
          ...new Map(
            [
              ...original.participations.map((p) => ({
                id: p.participantId,
                name:
                  p.participantId === self ? copy("You", "我") : p.nameSnapshot,
                kind: "account" as const,
                role: "",
              })),
              ...context.members.map((p) => ({
                ...p,
                name: p.id === self ? copy("You", "我") : p.name,
              })),
            ].map((p) => [p.id, p]),
          ).values(),
        ]
      : [];
  const money = (n: number) =>
    original
      ? formatMinorAmount(n, original.currency, localeForLang(lang))
      : "";
  const ownPending = context?.funding.find((f) => f.status === "pending"),
    accountLocked = !!context?.funding.some(
      (f) => f.status === "posted" || f.status === "reversed",
    );
  const paidPeople =
    original && draft
      ? people.filter((p) => {
          try {
            return nonnegative(draft.paid[p.id] ?? "0", original.currency) > 0;
          } catch {
            return true;
          }
        })
      : [];
  let payload: ReturnType<typeof tripEditorPayload> | null = null,
    total: number | null = null,
    allocated: number | null = null,
    share = 0,
    balance = "",
    paymentComplete = false;
  if (original && draft) {
    try {
      total = parseMajorAmount(draft.amount, original.currency);
    } catch {
      /* unfinished input */
    }
    try {
      allocated = draft.consumers.reduce(
        (sum, id) =>
          sum + nonnegative(draft.shares[id] ?? "", original.currency),
        0,
      );
    } catch {
      /* unfinished shares */
    }
    try {
      if (total !== null) {
        reconcileMinorAmounts(
          Object.fromEntries(
            Object.entries(draft.paid).map(([id, raw]) => [
              id,
              nonnegative(raw || "0", original.currency),
            ]),
          ),
          total,
        );
        paymentComplete = true;
      }
    } catch {
      /* Keep invalid payment text in the draft. */
    }
    try {
      payload = tripEditorPayload(original, draft);
      allocated = payload.total_minor;
      share = payload.share_amounts[payload.participant_ids.indexOf(self)] ?? 0;
      const simulated: CanonicalExpense = {
        ...original,
        scope:
          context?.audience === "shared" || candidate === "shared"
            ? "space"
            : "personal",
        spaceId: context?.trip_id ?? null,
        totalMinor: payload.total_minor,
        participations: payload.participant_ids.map((id, i) => ({
          id,
          expenseId: original.id,
          participantId: id,
          nameSnapshot: people.find((p) => p.id === id)?.name ?? id,
          order: i,
          state: "accepted",
          trackingMode: "tracked",
        })),
        payerContributions: payload.participant_ids.map((id, i) => ({
          expenseId: original.id,
          expenseParticipationId: id,
          amountMinor: payload!.contribution_amounts[i],
        })),
        shares: payload.participant_ids.map((id, i) => ({
          expenseId: original.id,
          expenseParticipationId: id,
          amountMinor: payload!.share_amounts[i],
        })),
      };
      const lines =
        simulated.scope === "personal"
          ? []
          : deriveRelationalDebtLines(
              [
                ...tripAuthoritativeExpenses(ledger.expenses).filter(
                  (e) =>
                    e.id !== original.id &&
                    e.scope === "space" &&
                    e.spaceId === context?.trip_id,
                ),
                simulated,
              ],
              tripCurrentPayments(
                settlementRead.settlements,
                context?.trip_id ?? "",
              ),
              {
                scope: "space",
                spaceId: context?.trip_id ?? original.spaceId!,
              },
            );
      const collect = lines
          .filter((l) => l.creditorParticipantId === self)
          .reduce((n, l) => n + l.remainingMinor, 0),
        pay = lines
          .filter((l) => l.debtorParticipantId === self)
          .reduce((n, l) => n + l.remainingMinor, 0);
      balance =
        settlementRead.loading || settlementRead.error
          ? copy("Balance unavailable", "往来暂不可用")
          : collect || pay
            ? [
                collect ? copy("To collect ", "待收 ") + money(collect) : "",
                pay ? copy("To pay ", "待付 ") + money(pay) : "",
              ]
                .filter(Boolean)
                .join(" · ")
            : copy("No balance for you", "没有你的待结算金额");
    } catch {
      /* do not invent debt from a draft mismatch */
    }
  }
  const setAmount = (raw: string) => {
    if (!draft || !original) return;
    const next: Partial<TripEditorDraft> = { amount: raw };
    try {
      const n = parseMajorAmount(raw, original.currency);
      if (paidPeople.length === 1)
        next.paid = {
          ...draft.paid,
          [paidPeople[0].id]: minorText(n, original.currency),
        };
      if (context?.audience === "private" && !expanded)
        next.shares = { [original.createdBy]: minorText(n, original.currency) };
    } catch {
      /* temporary empty/decimal input remains */
    }
    patch(next);
  };
  const finishRefresh = async () => {
    window.dispatchEvent(new Event("tt:trip-expense-changed"));
    await onRefresh();
    requestAnimationFrame(() => {
      if (window.location.pathname !== location.pathname) return;
      const row = Array.from(
        document.querySelectorAll<HTMLElement>("[data-expense-id]"),
      ).find((node) => node.dataset.expenseId === savedExpenseId.current);
      const target = row?.querySelector<HTMLButtonElement>("button");
      if (target) target.focus({ preventScroll: true });
      else {const page=Array.from(document.querySelectorAll<HTMLElement>('[data-trip-id]')).find(node=>node.dataset.tripId===context?.trip_id);page?.querySelector<HTMLElement>('.tw-title-line h2')?.focus({preventScroll:true})}
    });
    inflight.current = false;
    baseline.current = JSON.stringify(draft);
    close();
  };
  const reconcile = async () => {
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setFocused(false);
    setError("");
    try {
      const pending = pendingTripEdit(self, expense.id);
      if (!pending) throw new Error("missing_recovery_command");
      const result = await reconcileTripEdit(pending.requestId);
      forgetTripEdit(self, expense.id);
      setUnknown(false);
      attempt.current = null;
      if (result.state === "committed") {
        savedExpenseId.current=result.expenseId??null;
        setCommitted(true);
        changeGuard(null);
        await finishRefresh();
      } else
        setError(
          copy(
            "The save did not commit. Review your draft before saving again.",
            "此次保存未提交，请核对草稿后重新保存。",
          ),
        );
    } catch (c) {
      setError(describeFailure(c));
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    try {
      if (pendingTripEdit(self, expense.id)) setUnknown(true);
    } catch {
      setError(
        lang === "zh"
          ? "无法恢复保存状态，尚未发送新的修改。"
          : "Saved command status is unavailable. No further edits have been sent.",
      );
      setUnknown(true);
    }
  }, [self, expense.id, lang]);
  const save = async () => {
    if (
      inflight.current ||
      unknown ||
      committed ||
      conflict ||
      !original ||
      !context ||
      !draft ||
      !context.can_edit ||
      !payload
    )
      return;
    const key = JSON.stringify([original.id, original.version, draft]);
    if (!attempt.current || attempt.current.key !== key)
      attempt.current = { key, id: generateId() };
    inflight.current = true;
    setBusy(true);
    setFocused(false);
    setError("");
    let sent = false,
      acked = false;
    try {
      await rememberTripEdit(self, expense.id, attempt.current.id, [
        original.id,
        original.version,
        draft,
      ]);
      sent = true;
      const receipt = await saveTripEditor(
        attempt.current.id,
        original,
        context,
        draft,
      );
      savedExpenseId.current = receipt.expense_id;
      acked = true;
      setCommitted(true);
      forgetTripEdit(self, expense.id);
      await finishRefresh();
    } catch (c) {
      setError(describeFailure(c));
      if (sent && !acked && !(c instanceof TripEditorRejected))
        setUnknown(true);
      else if (sent && !acked) forgetTripEdit(self, expense.id);
      focusError();
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  };
  const cancel = async () => {
    if (
      inflight.current ||
      unknown ||
      committed ||
      !original ||
      !context?.can_edit
    )
      return;
    inflight.current = true;
    setBusy(true);
    setFocused(false);
    setError("");
    try {
      await ledgerRepository.voidExpense(original.id, original.version);
      setCommitted(true);
      changeGuard(null);
      await finishRefresh();
    } catch (c) {
      setError(describeFailure(c));
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  };
  const allocation = !draft?.consumers.length
    ? copy("Select at least one consumer.", "请选择至少一名消费对象。")
    : total !== null && !paymentComplete
      ? copy(
          "Review payer amounts. Payments must match the expense total.",
          "请核对付款金额，付款合计须等于费用总额。",
        )
      : draft?.mode === "items" && !payload
        ? copy(
            "Review item amounts and people; items must match the expense total.",
            "请核对项目金额与成员，项目合计须等于费用总额。",
          )
        : total !== null && allocated !== null
          ? allocated === total
            ? copy("Allocated ", "已分配 ") +
              money(allocated) +
              " / " +
              money(total)
            : copy(
                allocated < total ? "Remaining " : "Over allocated ",
                allocated < total ? "尚未分配 " : "超额分配 ",
              ) + money(Math.abs(total - allocated))
          : copy("Review amounts and payments.", "请核对金额与付款。");
  const title = context?.can_edit
    ? copy("Edit expense", "编辑费用")
    : copy("Record details", "账目详情");
  const body = loading ? (
    <div role="status">
      {copy("Checking expense visibility…", "正在核验账目可见性…")}
    </div>
  ) : !original || !context || !draft ? (
    <div role="alert">
      <p>{error || copy("Expense is unavailable.", "无法读取费用。")}</p>
      <button type="button" onClick={() => setRetry((v) => v + 1)}>
        {copy("Retry", "重试")}
      </button>
    </div>
  ) : hidden ? (
    <section>
      <p>{t("notice.hiddenReview")}</p>
      <button
        type="button"
        onClick={() => useStore.getState().setHomeUi({ balanceHidden: false })}
      >
        {copy("Show amount to continue", "显示金额以继续")}
      </button>
    </section>
  ) : (
    <>
      <label
        className="ue-money-label"
        htmlFor="ue-amount"
        id="ue-amount-label"
      >
        {copy("Amount", "金额")} · {original.currency}
      </label>
      <div className="ue-amount-row" onClick={() => amountRef.current?.focus()}>
        <span className="ue-prefix">
          {original.currency === "MYR" ? "RM" : original.currency}
        </span>
        {context.can_edit ? (
          <div className="ue-number">
            <input
              id="ue-amount"
              ref={amountRef}
              className="ue-amount-input"
              aria-label={copy("Amount", "金额")}
              aria-invalid={total === null}
              aria-describedby={
                total === null
                  ? "ue-amount-label ue-amount-error"
                  : "ue-amount-label"
              }
              inputMode="decimal"
              autoComplete="off"
              disabled={!editable}
              value={draft.amount}
              data-formatted={!focused && total !== null}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => setAmount(e.target.value)}
            />
            {!focused && total !== null ? (
              <span className="ue-formatted" aria-hidden="true">
                {groupAmount(minorText(total, original.currency))}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="ue-amount-input">
            {groupAmount(minorText(original.totalMinor, original.currency))}
          </span>
        )}
        {context.can_edit ? <QuickIcon name="edit" size={18} /> : null}
      </div>
      {total === null ? (
        <p className="ue-error" id="ue-amount-error" role="alert">
          {copy("Enter a valid positive amount.", "请输入有效的正金额。")}
        </p>
      ) : null}
      <label className="ue-field">
        <span className="ue-label">{copy("Note", "备注")}</span>
        {context.can_edit ? (
          <input
            className="ue-input"
            disabled={!editable}
            value={draft.note}
            onChange={(e) => patch({ note: e.target.value })}
          />
        ) : (
          <span className="ue-read-value">{draft.note}</span>
        )}
      </label>
      <div className="ue-two">
        <label className="ue-field">
          <span className="ue-label">{copy("Category", "分类")}</span>
          {context.can_edit ? (
            <select
              className="ue-select"
              disabled={!editable}
              value={draft.category}
              onChange={(e) => patch({ category: e.target.value })}
            >
              {[
                ...new Set([...SELECTABLE_EXPENSE_CATEGORIES, draft.category]),
              ].map((c) => (
                <option key={c} value={c}>
                  {t(categoryKey(c))}
                </option>
              ))}
            </select>
          ) : (
            <span>{t(categoryKey(draft.category))}</span>
          )}
        </label>
        <label className="ue-field">
          <span className="ue-label">{copy("Date", "日期")}</span>
          {context.can_edit ? (
            <input
              className="ue-input"
              disabled={!editable}
              type="date"
              value={draft.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          ) : (
            <span>{draft.date}</span>
          )}
        </label>
      </div>
      {audience === "private" && !expanded ? (
        <>
          <div className="ue-field">
            <span className="ue-label">{copy("Account", "账户")}</span>
            {context.can_edit && !accountLocked ? (
              <select
                className="ue-select"
                aria-label={copy("Payment account", "付款账户")}
                disabled={!editable}
                value={
                  draft.accountChoice
                    ? (draft.accountChoice.account_id ??
                      (draft.accountChoice.defer ? "pending-unknown" : ""))
                    : (ownPending?.primary_account_id ??
                      ownPending?.account_id ??
                      (ownPending ? "pending-unknown" : ""))
                }
                onChange={(event) =>
                  patch({
                    accountChoice: {
                      intent_id: ownPending?.id ?? null,
                      version: ownPending?.version ?? null,
                      account_id:
                        event.target.value &&
                        event.target.value !== "pending-unknown"
                          ? event.target.value
                          : null,
                      defer: event.target.value !== "",
                    },
                  })
                }
              >
                <option value="">
                  {copy("No account linked", "未关联账户")}
                </option>
                <option value="pending-unknown">
                  {copy("Verify deduction later", "稍后核对扣款")}
                </option>
                {(context.accounts ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </option>
                ))}
              </select>
            ) : (
              <div className="ue-read-value ue-account">
                <TravelIcon name="wallet" />
                {context.funding
                  .map(
                    (f) =>
                      f.account_name ??
                      context.accounts?.find(
                        (a) => a.id === f.primary_account_id,
                      )?.name,
                  )
                  .filter(Boolean)
                  .join(" · ") || copy("No account linked", "未关联账户")}
              </div>
            )}
            <small>
              {copy(
                "Selecting an account does not confirm a deduction. Posted account history stays unchanged.",
                "选择账户不会确认扣款，已入账账户历史保持不变。",
              )}
            </small>
          </div>
          <p className="ue-section ue-sub">
            {copy("Recorded in ", "归属于 ")}
            {context.trip_name}
          </p>
          {context.can_edit && context.role && context.role !== "view" ? (
            <button
              type="button"
              className="ue-link-row ue-section"
              onClick={() => setExpanded(true)}
            >
              {copy("Split with trip members", "与行程成员分摊")}
              <span aria-hidden="true">＋</span>
            </button>
          ) : null}
        </>
      ) : (
        <div className="ue-field">
          <span className="ue-label">{copy("Paid by", "付款人")}</span>
          <button
            type="button"
            className="ue-payer-row"
            disabled={!editable}
            aria-expanded={payerOpen}
            onClick={() => setPayerOpen((v) => !v)}
          >
            <span>
              {paidPeople.map((p) => p.name).join(", ") ||
                copy("Review payments", "核对付款")}
            </span>
            <span aria-hidden="true">›</span>
          </button>
          {payerOpen ? (
            <div className="ue-payers">
              {people.map((p) => (
                <label key={p.id}>
                  <span>{p.name}</span>
                  <AmountInput
                    className="ue-share"
                    aria-label={copy("Paid by " + p.name, p.name + " 付款")}
                    inputMode="decimal"
                    value={draft.paid[p.id] ?? "0"}
                    disabled={!editable}
                    onValueChange={(raw) =>
                      patch({ paid: { ...draft.paid, [p.id]: raw } })
                    }
                  />
                </label>
              ))}
            </div>
          ) : null}
        </div>
      )}
      <div className="ue-split-wrap" data-open={expanded} inert={!expanded}>
        <div className="ue-split-inner">
          {expanded ? (
            <section
              className="ue-section ue-split"
              aria-label={copy("Split configuration", "分摊设置")}
            >
              <h2>{copy("Split", "分摊")}</h2>
              <div
                className="ue-methods"
                role="group"
                aria-label={copy("Split method", "分摊方式")}
              >
                {(["equal", "exact", "items"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={!editable}
                    aria-pressed={draft.mode === mode}
                    onClick={() => patch({ mode })}
                  >
                    {copy(
                      mode === "equal"
                        ? "Equally"
                        : mode === "exact"
                          ? "Amounts"
                          : "By item",
                      mode === "equal"
                        ? "平均"
                        : mode === "exact"
                          ? "指定金额"
                          : "按项目",
                    )}
                  </button>
                ))}
              </div>
              {draft.mode === "items" ? (
                <fieldset disabled={!editable} className="ue-items-fieldset">
                  <QuickItems
                    strict
                    keepOpen
                    zh={zh}
                    participants={people
                      .filter((p) => draft.consumers.includes(p.id))
                      .map((p) => ({ id: p.id, name: p.name }))}
                    values={{
                      amount: draft.amount,
                      currency: original.currency,
                      selectedParticipantIds: draft.consumers,
                      splitMode: "exact",
                      exactShareAmounts: draft.shares,
                      payerAmounts: draft.paid,
                      detailsExpanded: true,
                      items: draft.items,
                    }}
                    onUpdate={(v) => {
                      if (editable)
                        patch({
                          ...("items" in v ? { items: v.items ?? [] } : {}),
                          ...("exactShareAmounts" in v
                            ? { shares: v.exactShareAmounts }
                            : {}),
                        });
                    }}
                  />
                </fieldset>
              ) : null}
              <div className="ue-row ue-selection">
                <span>
                  {draft.consumers.length} / {people.length}{" "}
                  {copy("selected", "已选")}
                </span>
                <button
                  type="button"
                  className="ue-text-button"
                  disabled={!editable}
                  onClick={() =>
                    patch({
                      consumers: [
                        ...new Set([
                          ...draft.consumers,
                          ...context.members.map((p) => p.id),
                        ]),
                      ],
                    })
                  }
                >
                  {copy("Select all", "全选")}
                </button>
              </div>
              {people.map((p) => {
                const selected = draft.consumers.includes(p.id),
                  historical = !context.members.some((m) => m.id === p.id);
                let amount = draft.shares[p.id] ?? "";
                if (payload) {
                  const n =
                    payload.share_amounts[
                      payload.participant_ids.indexOf(p.id)
                    ] ?? 0;
                  amount = minorText(n, original.currency);
                }
                return (
                  <div
                    className="ue-member"
                    data-selected={selected}
                    key={p.id}
                  >
                    <label className="ue-check-name">
                      {context.can_edit ? (
                        <input
                          type="checkbox"
                          aria-label={p.name}
                          disabled={!editable || historical}
                          checked={selected}
                          onChange={() =>
                            patch({
                              consumers: selected
                                ? draft.consumers.filter((id) => id !== p.id)
                                : [...draft.consumers, p.id],
                            })
                          }
                        />
                      ) : (
                        <span aria-hidden="true">{selected ? "✓" : "○"}</span>
                      )}
                      <span className="ue-avatar" aria-hidden="true">
                        {p.name.slice(0, 1)}
                      </span>
                      <span className="ue-name">
                        {p.name}
                        {historical ? (
                          <small>
                            {copy(" · Historical member", " · 历史成员")}
                          </small>
                        ) : null}
                      </span>
                    </label>
                    {selected ? (
                      context.can_edit && draft.mode === "exact" ? (
                        <AmountInput
                          className="ue-share"
                          inputMode="decimal"
                          aria-label={copy(
                            "Share for " + p.name,
                            p.name + " 份额",
                          )}
                          disabled={!editable}
                          value={draft.shares[p.id] ?? ""}
                          onValueChange={(raw) =>
                            patch({
                              shares: { ...draft.shares, [p.id]: raw },
                            })
                          }
                        />
                      ) : (
                        <span className="ue-dash">{groupAmount(amount)}</span>
                      )
                    ) : (
                      <span className="ue-dash">—</span>
                    )}
                  </div>
                );
              })}
              <p
                className={payload ? "ue-allocation" : "ue-error"}
                aria-live="polite"
              >
                {allocation}
              </p>
              <div className="ue-my-share">
                <div className="ue-row">
                  <span>{copy("Your share", "你的份额")}</span>
                  <strong>{payload ? money(share) : "—"}</strong>
                </div>
                <p className="ue-sub">{balance}</p>
              </div>
              {context.audience === "shared" &&
              candidate === "private" &&
              original.createdBy === self &&
              context.can_edit ? (
                <button
                  type="button"
                  className="ue-text-button"
                  disabled={!editable}
                  onClick={() =>
                    draft.makePrivate
                      ? patch({ makePrivate: false })
                      : changeGuard("private")
                  }
                >
                  {draft.makePrivate
                    ? copy("Keep shared", "保留共享")
                    : copy("Make private after review", "核对后转为私人")}
                </button>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
      {statusNotice ? <p className="ue-sub">{statusNotice}</p> : null}
    </>
  );
  return createPortal(
    <section
      ref={dialog}
      className="ue-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      data-testid="unified-expense-editor"
    >
      <form
        className="ue-screen"
        onSubmit={(event) => {
          event.preventDefault();
          if (committed)
            void finishRefresh().catch((c) => setError(describeFailure(c)));
          else if (unknown) void reconcile();
          else if (editable && payload) void save();
        }}
      >
        <header className="ue-header">
          <div className="ue-title-row">
            <h1>{title}</h1>
            <button
              type="button"
              className="ue-close"
              aria-label={copy("Close expense editor", "关闭费用编辑")}
              disabled={busy || unknown}
              onClick={requestClose}
            >
              ×
            </button>
          </div>
          {context ? (
            <>
              <div className="ue-row">
                <span className="ue-context">{context.trip_name}</span>
                <span className="ue-visibility">
                  {copy(
                    audience === "private"
                      ? "Only you"
                      : audience === "shared"
                        ? "Shared"
                        : "Checking visibility",
                    audience === "private"
                      ? "仅自己"
                      : audience === "shared"
                        ? "共享"
                        : "核验可见性",
                  )}
                </span>
              </div>
              <p className="ue-privacy-note" aria-live="polite">
                {copy(
                  context.audience === "private" && audience === "shared"
                    ? "Saving will share this expense with trip members."
                    : draft?.makePrivate
                      ? "Saving will create a private successor after server checks."
                      : audience === "private"
                        ? "Only you can see this expense."
                        : "Visible to trip members",
                  context.audience === "private" && audience === "shared"
                    ? "保存后将向行程成员共享这笔费用。"
                    : draft?.makePrivate
                      ? "保存时服务端核验后建立私人后继版本。"
                      : audience === "private"
                        ? "只有你能查看这笔费用。"
                        : "行程成员可见",
                )}
              </p>
            </>
          ) : null}
        </header>
        <div
          ref={bodyRef}
          className="ue-body"
          data-testid={
            context && !context.can_edit ? "record-readonly-details" : undefined
          }
        >
          {body}
          {conflict ? (
            <p className="ue-error" role="alert">
              {copy(
                "This record changed. Reload the latest record before saving.",
                "账目已变化，请重新读取最新版本后再保存。",
              )}
            </p>
          ) : null}
          {committed ? (
            <p role="status">
              {copy("Saved. Updating the list…", "已保存，正在刷新列表…")}
            </p>
          ) : unknown ? (
            <p role="status">
              {copy(
                "Save status is uncertain. Check its status before editing or saving again.",
                "保存状态未确认，请先检查结果再继续编辑或保存。",
              )}
            </p>
          ) : null}
          {error || conflict ? (
            <div className="ue-error" role="alert">
              <p>{error}</p>
              {context && original && !unknown && !committed ? (
                <button
                  type="button"
                  onClick={() => {
                    if (dirty) changeGuard("reload");
                    else setRetry((v) => v + 1);
                  }}
                >
                  {copy("Reload latest record", "重新读取最新账目")}
                </button>
              ) : null}
            </div>
          ) : null}
          {guard ? (
            <div className="ue-confirm" role="alert">
              <h2>
                {copy(
                  guard === "discard" || guard === "reload"
                    ? "Discard unsaved changes?"
                    : guard === "cancel"
                      ? "Cancel this expense?"
                      : "Create a private successor?",
                  guard === "discard" || guard === "reload"
                    ? "放弃未保存的修改？"
                    : guard === "cancel"
                      ? "取消这笔费用？"
                      : "建立私人后继版本？",
                )}
              </h2>
              <p>
                {copy(
                  guard === "cancel"
                    ? "This uses the original cancellation and financial history rules."
                    : guard === "private"
                      ? "The server must verify there are no shared obligations or settlement dependencies. Existing shared audit history stays protected."
                      : "This closes your draft without cancelling the expense.",
                  guard === "cancel"
                    ? "将沿用原取消及金融历史规则。"
                    : guard === "private"
                      ? "服务端须核验无共享债务或结算依赖；原共享审计历史保留。"
                      : "只关闭草稿，不会取消费用。",
                )}
              </p>
              <button type="button" onClick={() => changeGuard(null)}>
                {copy("Keep editing", "继续编辑")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (guard === "discard") {
                    baseline.current = JSON.stringify(draft);
                    changeGuard(null);
                    close();
                  } else if (guard === "reload") {
                    changeGuard(null);
                    setRetry((v) => v + 1);
                  } else if (guard === "private") {
                    setDraft((old) =>
                      old ? { ...old, makePrivate: true } : old,
                    );
                    changeGuard(null);
                  } else void cancel();
                }}
              >
                {copy(
                  guard === "reload"
                    ? "Discard and reload"
                    : guard === "discard"
                      ? "Discard changes"
                      : guard === "cancel"
                        ? "Confirm cancel"
                        : "Confirm private",
                  guard === "reload"
                    ? "放弃并重新读取"
                    : guard === "discard"
                      ? "放弃修改"
                      : guard === "cancel"
                        ? "确认取消"
                        : "确认转为私人",
                )}
              </button>
            </div>
          ) : null}
        </div>
        {(context?.can_edit||unknown||committed) && !loading && (!hidden||unknown||committed) ? (
          <footer className="ue-footer">
            <button
              className="ue-save"
              type="submit"
              disabled={
                busy ||
                (!unknown&&!committed&&conflict) ||
                !!guard ||
                (!unknown && !committed && (!payload || !dirty))
              }
            >
              {busy
                ? copy("Saving…", "保存中…")
                : committed
                  ? copy("Saved · refresh", "已保存 · 刷新")
                  : unknown
                    ? copy("Check save status", "检查保存状态")
                    : copy("Save changes", "保存修改")}
            </button>
            {context?.can_edit?            <button
              type="button"
              className="ue-cancel"
              disabled={busy || unknown || committed || !!guard}
              onClick={() => changeGuard("cancel")}
            >
              {copy("Cancel expense", "取消费用")}
            </button>:null}
          </footer>
        ) : null}
      </form>
    </section>,
    document.getElementById("root") ?? document.body,
  );
}
