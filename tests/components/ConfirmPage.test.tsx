const mockReplace = jest.fn()
const mockPush = jest.fn()
const mockBack = jest.fn()

// A stable router object prevents re-render loops caused by useEffect([router])
// detecting a new object reference on every render.
const stableRouter = { push: mockPush, replace: mockReplace, back: mockBack }

jest.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
}))

jest.mock('@/components/ConfirmGate', () => ({
  ConfirmGate: (props: { onConfirm: () => void }) =>
    require('react').createElement('button', { onClick: props.onConfirm, 'data-testid': 'confirm-gate' }, 'Confirm'),
}))

jest.mock('@/components/CommandOutput', () => ({
  CommandOutput: (props: { command: string }) =>
    require('react').createElement('pre', { 'data-testid': 'command-output' }, props.command),
}))

jest.mock('@/components/DeleteProgress', () => ({
  DeleteProgress: (props: { onComplete: (r: unknown[]) => void }) =>
    require('react').createElement('button', { onClick: () => props.onComplete([]), 'data-testid': 'delete-progress' }, 'Done'),
}))

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ConfirmPage from '@/app/confirm/page'

beforeEach(() => {
  jest.clearAllMocks()
  sessionStorage.clear()
  ;(global.fetch as jest.Mock).mockResolvedValue({
    json: async () => ({ login: 'alice' }),
  })
})

global.fetch = jest.fn().mockResolvedValue({
  json: async () => ({ login: 'alice' }),
})

describe('/confirm page', () => {
  it('redirects to /repos when sessionStorage is empty', async () => {
    render(<ConfirmPage />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/repos'))
  })

  it('renders selected repo names', async () => {
    sessionStorage.setItem('depo:selected', JSON.stringify(['alpha', 'beta']))
    render(<ConfirmPage />)
    await waitFor(() => expect(screen.getByText('alpha')).toBeInTheDocument())
    expect(screen.getByText('beta')).toBeInTheDocument()
  })

  it('shows count in heading', async () => {
    sessionStorage.setItem('depo:selected', JSON.stringify(['alpha', 'beta']))
    render(<ConfirmPage />)
    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent('2 repositories'))
  })

  it('shows ConfirmGate by default', async () => {
    sessionStorage.setItem('depo:selected', JSON.stringify(['alpha']))
    render(<ConfirmPage />)
    await waitFor(() => expect(screen.getByTestId('confirm-gate')).toBeInTheDocument())
  })

  it('switches to DeleteProgress after ConfirmGate confirms', async () => {
    sessionStorage.setItem('depo:selected', JSON.stringify(['alpha']))
    render(<ConfirmPage />)
    await waitFor(() => screen.getByTestId('confirm-gate'))
    fireEvent.click(screen.getByTestId('confirm-gate'))
    await waitFor(() => expect(screen.getByTestId('delete-progress')).toBeInTheDocument())
  })

  it('shows CommandOutput when mode is gh', async () => {
    sessionStorage.setItem('depo:selected', JSON.stringify(['alpha']))
    render(<ConfirmPage />)
    await waitFor(() => screen.getByRole('group', { name: /output mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate gh command/i }))
    await waitFor(() => expect(screen.getByTestId('command-output')).toBeInTheDocument())
  })

  it('writes results to sessionStorage and navigates to /done after deletion', async () => {
    sessionStorage.setItem('depo:selected', JSON.stringify(['alpha']))
    render(<ConfirmPage />)
    await waitFor(() => screen.getByTestId('confirm-gate'))
    fireEvent.click(screen.getByTestId('confirm-gate'))
    await waitFor(() => screen.getByTestId('delete-progress'))
    fireEvent.click(screen.getByTestId('delete-progress'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/done'))
    const results = sessionStorage.getItem('depo:results')
    expect(results).not.toBeNull()
  })

  it('redirects to /repos when sessionStorage contains invalid JSON', async () => {
    sessionStorage.setItem('depo:selected', 'not-valid-json')
    render(<ConfirmPage />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/repos'))
  })

  it('redirects to /repos when selection is an empty array', async () => {
    sessionStorage.setItem('depo:selected', JSON.stringify([]))
    render(<ConfirmPage />)
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/repos'))
  })

  it('shows singular heading when one repo is selected', async () => {
    sessionStorage.setItem('depo:selected', JSON.stringify(['only-one']))
    render(<ConfirmPage />)
    await waitFor(() => expect(screen.getByRole('heading')).toHaveTextContent('1 repository for deletion'))
  })

  it('shows CommandOutput when mode is curl', async () => {
    sessionStorage.setItem('depo:selected', JSON.stringify(['alpha']))
    render(<ConfirmPage />)
    await waitFor(() => screen.getByRole('group', { name: /output mode/i }))
    fireEvent.click(screen.getByRole('button', { name: /generate curl command/i }))
    await waitFor(() => expect(screen.getByTestId('command-output')).toBeInTheDocument())
  })

  it('clears SESSION_KEY_SELECTED from sessionStorage after deletion completes', async () => {
    sessionStorage.setItem('depo:selected', JSON.stringify(['alpha']))
    render(<ConfirmPage />)
    await waitFor(() => screen.getByTestId('confirm-gate'))
    fireEvent.click(screen.getByTestId('confirm-gate'))
    await waitFor(() => screen.getByTestId('delete-progress'))
    fireEvent.click(screen.getByTestId('delete-progress'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/done'))
    expect(sessionStorage.getItem('depo:selected')).toBeNull()
  })
})
