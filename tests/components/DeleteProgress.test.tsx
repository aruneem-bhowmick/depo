import { render, screen, waitFor } from '@testing-library/react'
import { DeleteProgress } from '@/components/DeleteProgress'
import type { DeletionResult } from '@/lib/types'

global.fetch = jest.fn()

beforeEach(() => jest.clearAllMocks())

describe('DeleteProgress', () => {
  it('shows indeterminate progress bar while loading', () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {})) // never resolves
    render(<DeleteProgress repos={['r1']} onComplete={jest.fn()} />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('shows deletion count text while loading', () => {
    ;(global.fetch as jest.Mock).mockReturnValue(new Promise(() => {}))
    render(<DeleteProgress repos={['r1', 'r2']} onComplete={jest.fn()} />)
    expect(screen.getByText(/deleting 2 repositories/i)).toBeInTheDocument()
  })

  it('renders results after API response', async () => {
    const results: DeletionResult[] = [
      { repo: 'r1', status: 'deleted' },
      { repo: 'r2', status: 'error', error: 'Not found' },
    ]
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ results }),
    })
    render(<DeleteProgress repos={['r1', 'r2']} onComplete={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('r1')).toBeInTheDocument())
    expect(screen.getByText('r2')).toBeInTheDocument()
  })

  it('shows green checkmark for deleted status', async () => {
    const results: DeletionResult[] = [{ repo: 'r1', status: 'deleted' }]
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results }) })
    render(<DeleteProgress repos={['r1']} onComplete={jest.fn()} />)
    await waitFor(() => screen.getByLabelText('Deleted'))
    expect(screen.getByLabelText('Deleted')).toBeInTheDocument()
  })

  it('shows error X and error message for error status', async () => {
    const results: DeletionResult[] = [{ repo: 'r1', status: 'error', error: 'Not found' }]
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results }) })
    render(<DeleteProgress repos={['r1']} onComplete={jest.fn()} />)
    await waitFor(() => screen.getByLabelText('Error'))
    expect(screen.getByText('Not found')).toBeInTheDocument()
  })

  it('calls onComplete with results after API response', async () => {
    const onComplete = jest.fn()
    const results: DeletionResult[] = [{ repo: 'r1', status: 'deleted' }]
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results }) })
    render(<DeleteProgress repos={['r1']} onComplete={onComplete} />)
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(results))
  })

  it('shows error alert when fetch throws', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
    render(<DeleteProgress repos={['r1']} onComplete={jest.fn()} />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('shows error alert when response is not ok', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not authenticated' }),
    })
    render(<DeleteProgress repos={['r1']} onComplete={jest.fn()} />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('Not authenticated')
  })

  it('does not call onComplete when response is not ok', async () => {
    const onComplete = jest.fn()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    })
    render(<DeleteProgress repos={['r1']} onComplete={onComplete} />)
    await waitFor(() => screen.getByRole('alert'))
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('calls POST /api/delete with the repos array', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ results: [] }) })
    render(<DeleteProgress repos={['a', 'b']} onComplete={jest.fn()} />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/delete',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ repos: ['a', 'b'] }),
      }),
    ))
  })
})
