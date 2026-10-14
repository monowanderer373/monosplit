import { useImperativeHandle, useLayoutEffect, useRef, type ComponentPropsWithRef } from 'react'
import { groupAmount } from '../lib/amountDisplay'

type Props = Omit<ComponentPropsWithRef<'input'>, 'value' | 'type' | 'onChange'> & { value: string; onValueChange?: (value: string) => void }

/** Display grouped digits; every caller continues receiving ungrouped draft text. */
export default function AmountInput({ value, onValueChange, onKeyDown, ref, placeholder, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const selection = useRef<[number, number] | null>(null)
  useImperativeHandle(ref, () => inputRef.current!)
  useLayoutEffect(() => {
    if (selection.current && inputRef.current) {
      inputRef.current.setSelectionRange(...selection.current)
      selection.current = null
    }
  })
  return <input {...props} ref={inputRef} type="text" inputMode="decimal"
    placeholder={placeholder === undefined ? undefined : groupAmount(placeholder)} value={groupAmount(value)}
    onChange={event => {
      const input = event.currentTarget
      let displayed = input.value, start = input.selectionStart, end = input.selectionEnd
      const inputType = (event.nativeEvent as InputEvent).inputType
      // Mobile input events can delete a comma without emitting a keydown.
      if (displayed.replaceAll(',', '') === value.replaceAll(',', '') && displayed !== groupAmount(value) && start === end && start !== null) {
        if (inputType === 'deleteContentBackward' && start > 0) {
          displayed = displayed.slice(0, start - 1) + displayed.slice(start)
          start--; end = start
        } else if (inputType === 'deleteContentForward') {
          displayed = displayed.slice(0, start) + displayed.slice(start + 1)
        }
      }
      const position = (at: number | null) => {
        const prefix = displayed.slice(0, at ?? displayed.length).replaceAll(',', '')
        // Grouping the prefix alone misses a separator immediately before the caret.
        const raw = displayed.replaceAll(',', ''), grouped = groupAmount(raw)
        let digits = 0, i = 0
        while (i < grouped.length && digits < prefix.length) {
          if (grouped[i] !== ',') digits++
          i++
        }
        return i
      }
      selection.current = [position(start), position(end)]
      onValueChange?.(displayed.replaceAll(',', ''))
    }}
    onKeyDown={event => {
      onKeyDown?.(event)
      if (event.defaultPrevented || props.readOnly || event.altKey || event.ctrlKey || event.metaKey) return
      const input = event.currentTarget, start = input.selectionStart, end = input.selectionEnd
      if (start === null || start !== end) return
      // A separator is presentation, so deletion should remove the adjacent digit.
      if (event.key === 'Backspace' && input.value[start - 1] === ',') input.setSelectionRange(start - 2, start)
      if (event.key === 'Delete' && input.value[start] === ',') input.setSelectionRange(start, start + 2)
    }} />
}
