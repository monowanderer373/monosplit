import { useT } from '../lib/i18n'
import CenterActionButton from './navigation/CenterActionButton'
import './navigation/paper.css'

type Props = {
  onAdd: () => void
  composerOpen?: boolean
  disabled?: boolean
  standalone?: boolean
}

export default function GlobalMoneyAction({ onAdd, composerOpen = false, disabled = false, standalone = false }: Props) {
  const t = useT()

  return (
    <div className={`tt-center-layer z-[45]${standalone ? " tt-center-layer--standalone" : ""}`} data-testid="global-money-action-layer">
      <CenterActionButton
        label={t('ledger.quickAddLabel')}
        onClick={onAdd}
        open={composerOpen}
        disabled={disabled}
      />
    </div>
  )
}
