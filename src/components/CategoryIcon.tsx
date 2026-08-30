import { normalizeCategory, type ExpenseCategory } from '../lib/categories'

/**
 * Monochrome category glyphs.
 *
 * The ledger used to tint every row with one of ten category colours, three of
 * which sat in the same warm range as the accent — so orange stopped meaning
 * "you can act here". Shape carries the category instead, and colour is left
 * free to mean something.
 */
const GLYPHS: Record<ExpenseCategory, React.ReactNode> = {
  Food: (
    <>
      <path d="M3 2v7a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V2" />
      <path d="M5.5 11v11" />
      <path d="M18 2a4 4 0 0 0-3 3.9V12h3Zm0 10v10" />
    </>
  ),
  Drinks: (
    <>
      <path d="M5 4h14l-1.4 15.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8Z" />
      <path d="M5.6 10h12.8" />
    </>
  ),
  Groceries: (
    <>
      <circle cx="8" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h2.2l2.6 11.6a1.8 1.8 0 0 0 1.8 1.4h9.2a1.8 1.8 0 0 0 1.8-1.4L21 7H5" />
    </>
  ),
  Transportation: (
    <>
      <path d="M4 5h16a1 1 0 0 1 1 1v9H3V6a1 1 0 0 1 1-1Z" />
      <path d="M3 10h18" />
      <path d="M9 5v5" />
      <path d="M15 5v5" />
      <circle cx="7" cy="18" r="1.6" />
      <circle cx="17" cy="18" r="1.6" />
    </>
  ),
  Flight: <path d="M10.2 4.5 4 3l1.4 5.6L11 11l-3.4 3.4-3.3-.7-.9 1.4 3.4 2 2 3.4 1.4-.9-.7-3.3L13 13l2.4 5.6L21 20l-1.5-6.2L21 12l-1-1.6-3.4 1L14.3 8l3-3.3-.4-1.4-1.4-.4-3.3 3-2.4-2.2Z" />,
  Accommodation: (
    <>
      <path d="M15 21v-7a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v7" />
      <path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </>
  ),
  Shopping: (
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  Sightseeing: (
    <>
      <path d="M14.1 5.6a2 2 0 0 0 1.8 0l3.6-1.8a1 1 0 0 1 1.5.9v12.7a1 1 0 0 1-.6.9l-4.5 2.3a2 2 0 0 1-1.8 0l-4.2-2.1a2 2 0 0 0-1.8 0l-3.6 1.8a1 1 0 0 1-1.5-.9V6.6a1 1 0 0 1 .6-.9l4.5-2.3a2 2 0 0 1 1.8 0Z" />
      <path d="M15 5.8v15" />
      <path d="M9 3.2v15" />
    </>
  ),
  Activities: (
    <>
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 11v2" />
      <path d="M13 17v2" />
    </>
  ),
  Other: (
    <>
      <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z" />
      <path d="M7.5 7.5h.01" />
    </>
  ),
  Refund: (
    <>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </>
  ),
}

type Props = {
  category: string
  className?: string
  size?: number
}

export default function CategoryIcon({ category, className, size = 17 }: Props) {
  const key = normalizeCategory(category)
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[key]}
    </svg>
  )
}
