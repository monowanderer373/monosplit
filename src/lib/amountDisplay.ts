/** Presentation only. Never coerce editable decimals through Number/parseFloat. */
export function groupAmount(value: string): string {
  const raw = value.replaceAll(',', '')
  if (!/^-?\d*(?:\.\d*)?$/.test(raw)) return value
  const [whole, fraction] = raw.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return grouped + (fraction === undefined ? '' : `.${fraction}`)
}

/** Group each operand while retaining the calculator's original expression. */
export function groupCalculation(expression: string): string {
  return expression.replace(/\d+(?:\.\d*)?|\.\d+/g, groupAmount)
}
