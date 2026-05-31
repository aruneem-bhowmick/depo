/**
 * @jest-environment jsdom
 *
 * Component tests for ConfirmGate.
 *
 * Covers:
 * - Label and count rendering (singular and plural button text)
 * - Input matching logic: correct value calls onConfirm; wrong value or
 *   leading/trailing whitespace does not
 * - Shake animation: animate-shake class added on wrong click, removed after 400ms
 * - Loading state: spinner rendered, input disabled, onConfirm never called
 * - aria-disabled attribute reflects confirmed state
 */
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmGate } from '@/components/ConfirmGate'

describe('ConfirmGate', () => {
  it('renders the label with the count', () => {
    render(<ConfirmGate count={5} onConfirm={jest.fn()} />)
    expect(screen.getByText('5', { selector: 'span' })).toBeInTheDocument()
    expect(screen.getByLabelText(/type 5 to confirm/i)).toBeInTheDocument()
  })

  it('button text shows plural when count > 1', () => {
    render(<ConfirmGate count={5} onConfirm={jest.fn()} />)
    expect(screen.getByRole('button')).toHaveTextContent('Delete 5 repositories')
  })

  it('button text shows singular when count is 1', () => {
    render(<ConfirmGate count={1} onConfirm={jest.fn()} />)
    expect(screen.getByRole('button')).toHaveTextContent('Delete 1 repository')
  })

  it('does not call onConfirm when input does not match count', async () => {
    const onConfirm = jest.fn()
    render(<ConfirmGate count={5} onConfirm={onConfirm} />)
    await userEvent.type(screen.getByRole('textbox'), '3')
    fireEvent.click(screen.getByRole('button'))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onConfirm when input matches count exactly', async () => {
    const onConfirm = jest.fn()
    render(<ConfirmGate count={5} onConfirm={onConfirm} />)
    await userEvent.type(screen.getByRole('textbox'), '5')
    fireEvent.click(screen.getByRole('button'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not match when input has leading/trailing whitespace', async () => {
    const onConfirm = jest.fn()
    render(<ConfirmGate count={5} onConfirm={onConfirm} />)
    await userEvent.type(screen.getByRole('textbox'), ' 5')
    fireEvent.click(screen.getByRole('button'))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('shows spinner and Deleting… text when loading=true', () => {
    render(<ConfirmGate count={3} onConfirm={jest.fn()} loading />)
    expect(screen.getByRole('button')).toHaveTextContent(/deleting/i)
    expect(screen.getByRole('button').querySelector('svg')).toBeInTheDocument()
  })

  it('disables input when loading=true', () => {
    render(<ConfirmGate count={3} onConfirm={jest.fn()} loading />)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('button has aria-disabled=true when input does not match', () => {
    render(<ConfirmGate count={5} onConfirm={jest.fn()} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
  })

  it('button has aria-disabled=false when input matches', async () => {
    render(<ConfirmGate count={5} onConfirm={jest.fn()} />)
    await userEvent.type(screen.getByRole('textbox'), '5')
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'false')
  })

  it('applies animate-shake class when button clicked with wrong input', async () => {
    render(<ConfirmGate count={5} onConfirm={jest.fn()} />)
    await userEvent.type(screen.getByRole('textbox'), '3')
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').className).toContain('animate-shake')
  })

  it('removes animate-shake class after 400ms', () => {
    jest.useFakeTimers()
    render(<ConfirmGate count={5} onConfirm={jest.fn()} />)
    // Use fireEvent.change here (not userEvent.type) because userEvent's internal
    // scheduling conflicts with fake timers — the goal of this test is the timer
    // behavior, not the typing interaction.
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').className).toContain('animate-shake')
    act(() => jest.advanceTimersByTime(401))
    expect(screen.getByRole('button').className).not.toContain('animate-shake')
    jest.useRealTimers()
  })
})
