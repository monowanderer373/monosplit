import { useT } from '../lib/i18n'
import CenterActionButton from './navigation/CenterActionButton'
import './navigation/paper.css'

type Props = {
  onAdd: () => void
  composerOpen?: boolean
  disabled?: boolean
}

export default function GlobalMoneyAction({ onAdd, composerOpen = false, disabled = false }: Props) {
  const t = useT()

  return (
    <div className="tt-center-layer z-[45]" data-testid="global-money-action-layer">
      <CenterActionButton
        label={t('ledger.quickAddLabel')}
        onClick={onAdd}
        open={composerOpen}
        disabled={disabled}
      />
    </div>
  )
}
