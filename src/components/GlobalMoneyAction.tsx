import { useT } from '../lib/i18n'

type Props = {
  onAdd: () => void
}

export default function GlobalMoneyAction({ onAdd }: Props) {
  const t = useT()

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[45] flex justify-center"
      data-testid="global-money-action-layer"
      style={{
        bottom:
          'calc(max(0.75rem, env(safe-area-inset-bottom)) + 1rem)',
      }}
    >
      <button
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ms-accent)] text-3xl font-light text-white shadow-[var(--ms-elev-accent)]"
        onClick={onAdd}
        aria-label={t('ledger.quickAddLabel')}
      >
        +
      </button>
    </div>
  )
}
