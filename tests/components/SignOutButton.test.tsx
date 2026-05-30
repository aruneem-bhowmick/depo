import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SignOutButton } from '@/components/SignOutButton'

const mockPush = jest.fn()
const mockRefresh = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}))

global.fetch = jest.fn().mockResolvedValue({ ok: true })

beforeEach(() => jest.clearAllMocks())

describe('SignOutButton', () => {
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

  it('navigates to / after sign out', async () => {
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

  it('calls fetch exactly once per click', async () => {
    render(<SignOutButton />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
  })
})
