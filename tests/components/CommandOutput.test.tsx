import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { CommandOutput } from '@/components/CommandOutput'

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  })
})

describe('CommandOutput', () => {
  it('renders the command in a code block', () => {
    render(<CommandOutput command="gh repo delete alice/r --yes" mode="gh" />)
    expect(screen.getByRole('code')).toHaveTextContent('gh repo delete alice/r --yes')
  })

  it('renders a Copy button', () => {
    render(<CommandOutput command="test" mode="gh" />)
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })

  it('calls clipboard.writeText on Copy click', async () => {
    render(<CommandOutput command="test-command" mode="gh" />)
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-command'))
  })

  it('shows "Copied!" after successful copy', async () => {
    render(<CommandOutput command="test" mode="gh" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('Copied!'))
  })

  it('reverts to "Copy" after 2000ms', async () => {
    jest.useFakeTimers()
    render(<CommandOutput command="test" mode="gh" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => screen.getByRole('button'))
    act(() => jest.advanceTimersByTime(2001))
    expect(screen.getByRole('button')).toHaveTextContent('Copy')
    jest.useRealTimers()
  })

  it('does not show the curl warning for gh mode', () => {
    render(<CommandOutput command="test" mode="gh" />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('shows the curl warning for curl mode', () => {
    render(<CommandOutput command="TOKEN=..." mode="curl" />)
    expect(screen.getByRole('note')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/placeholder/i)
  })

  it('warns not to store tokens in shell history', () => {
    render(<CommandOutput command="" mode="curl" />)
    expect(screen.getByRole('note')).toHaveTextContent(/shell history/i)
  })
})
