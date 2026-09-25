export default function CenterActionButton({
  label,
  onClick,
  disabled = false,
  open = false,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  open?: boolean
}) {
  return (
    <button
      type="button"
      className="tt-seal"
      aria-label={label}
      aria-pressed={open}
      data-open={open ? 'true' : 'false'}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="tt-seal-plus" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>
    </button>
  )
}
