export default function PaperBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return <span className="tt-badge">{count > 9 ? '9+' : count}</span>
}
