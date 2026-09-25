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
      +
    </button>
  )
}
