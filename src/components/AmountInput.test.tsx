// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import AmountInput from './AmountInput'
import { parseMajorAmount } from '../lib/money'

afterEach(cleanup)
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <><AmountInput aria-label="Amount" value={value} onValueChange={raw => setValue(raw)} /><output data-testid="raw">{value}</output></>
}
it('groups typing and pasted text without changing raw decimals or saved minor units', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  const input = screen.getByRole('textbox') as HTMLInputElement
  await user.type(input, '90000')
  expect(input.value).toBe('90,000')
  expect(screen.getByTestId('raw').textContent).toBe('90000')
  expect(parseMajorAmount(screen.getByTestId('raw').textContent!, 'VND')).toBe(90000)
  await user.clear(input)
  await user.click(input)
  await user.paste('3,450.05')
  expect(input.value).toBe('3,450.05')
  expect(screen.getByTestId('raw').textContent).toBe('3450.05')
  expect(parseMajorAmount(screen.getByTestId('raw').textContent!, 'CNY')).toBe(345005)
})
it('retains the caret when inserting in the middle and deletes digits across grouping separators', async () => {
  const user = userEvent.setup()
  render(<Harness initial="12345.60" />)
  const input = screen.getByRole('textbox') as HTMLInputElement
  input.focus(); input.setSelectionRange(1, 1)
  await user.keyboard('9')
  expect(input.value).toBe('192,345.60')
  expect(input.selectionStart).toBe(2)
  input.setSelectionRange(4, 4)
  await user.keyboard('{Backspace}')
  expect(input.value).toBe('19,345.60')
  input.setSelectionRange(2, 2)
  await user.keyboard('{Delete}')
  expect(input.value).toBe('1,945.60')
  expect(screen.getByTestId('raw').textContent).toBe('1945.60')
})
it('keeps unfinished decimals, negative balances and exact large canonical values editable', () => {
  render(<Harness initial="90071992547409.90" />)
  const input = screen.getByRole('textbox') as HTMLInputElement
  expect(input.value).toBe('90,071,992,547,409.90')
  fireEvent.change(input, { target: { value: '6,000.' } })
  expect(input.value).toBe('6,000.')
  fireEvent.change(input, { target: { value: '-6,000.00' } })
  expect(screen.getByTestId('raw').textContent).toBe('-6000.00')
})
it('handles mobile deletion events without requiring a hardware keydown', () => {
  render(<Harness initial="1234" />)
  const input = screen.getByRole('textbox') as HTMLInputElement
  fireEvent.input(input, { target: { value: '1234', selectionStart: 1, selectionEnd: 1 }, inputType: 'deleteContentBackward' })
  expect(input.value).toBe('234')
  expect(screen.getByTestId('raw').textContent).toBe('234')
})
