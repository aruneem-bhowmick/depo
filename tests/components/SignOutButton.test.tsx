import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SignOutButton } from '@/components/SignOutButton'

const mockPush = jest.fn()
const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('SignOutButton — success path', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true })
  })

  it('renders a sign out button', () => {
    render(<SignOutButton />)
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('calls POST /api/signout on click', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/signout', { method: 'POST' })
    })
  })

  it('calls fetch exactly once per click', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  })

  it('navigates to / after a successful sign out', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'))
  })

  it('calls router.refresh() after navigation', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
  })

  it('has correct focus styles via className', () => {
    render(<SignOutButton />)
    const button = screen.getByRole('button', { name: /sign out/i })
    expect(button.className).toContain('focus:ring-2')
    expect(button.className).toContain('focus:ring-violet-500')
  })

  it('shows no error alert on success', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(mockPush).toHaveBeenCalled())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('SignOutButton — failure path (non-2xx response)', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 })
  })

  it('does not navigate to / when response is not ok', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not call router.refresh() when response is not ok', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('shows an error alert when response is not ok', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    )
    expect(screen.getByRole('alert').textContent).toContain('500')
  })

  it('logs the error to console on a non-2xx response', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        '[SignOutButton]',
        expect.any(Error),
      )
    )
  })
})

describe('SignOutButton — failure path (non-Error rejection value)', () => {
  // Exercises the false branch of: err instanceof Error ? err.message : 'Sign-out failed...'
  // fetch can reject with a plain string or any non-Error value in theory.
  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue('plain string rejection')
  })

  it('shows the fallback error message when fetch rejects with a non-Error value', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-out failed. Please try again.')
  })

  it('does not navigate to / on a non-Error rejection', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(mockPush).not.toHaveBeenCalled()
  })
})

describe('SignOutButton — failure path (network error)', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'))
  })

  it('does not navigate to / on a network error', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not call router.refresh() on a network error', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(console.error).toHaveBeenCalled())
    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('shows an error alert on a network error', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument()
    )
    expect(screen.getByRole('alert').textContent).toContain('Network failure')
  })

  it('logs the error to console on a network error', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() =>
      expect(console.error).toHaveBeenCalledWith(
        '[SignOutButton]',
        expect.objectContaining({ message: 'Network failure' }),
      )
    )
  })
})
