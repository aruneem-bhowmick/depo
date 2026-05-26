import {
  DELETION_DELAY_MS,
  MAX_BATCH_SIZE,
  SESSION_KEY_SELECTED,
  SESSION_KEY_RESULTS,
  SESSION_KEY_OAUTH_STATE,
} from '@/lib/constants'

describe('constants', () => {
  it('DELETION_DELAY_MS is 150', () => {
    expect(DELETION_DELAY_MS).toBe(150)
  })

  it('MAX_BATCH_SIZE is 100', () => {
    expect(MAX_BATCH_SIZE).toBe(100)
  })

  it('all SESSION_KEY values are prefixed with depo:', () => {
    expect(SESSION_KEY_SELECTED).toBe('depo:selected')
    expect(SESSION_KEY_RESULTS).toBe('depo:results')
    expect(SESSION_KEY_OAUTH_STATE).toBe('depo:oauth_state')
  })

  it('SESSION_KEY values are unique', () => {
    const keys = [SESSION_KEY_SELECTED, SESSION_KEY_RESULTS, SESSION_KEY_OAUTH_STATE]
    const unique = new Set(keys)
    expect(unique.size).toBe(3)
  })
})
