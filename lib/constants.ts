// Delay between sequential deletions (ms).
// Keeps Depo within GitHub's secondary rate limits for destructive operations.
export const DELETION_DELAY_MS = 150

// Maximum repos that can be selected for a single deletion batch.
export const MAX_BATCH_SIZE = 100

// sessionStorage keys used across client components and pages.
export const SESSION_KEY_SELECTED = 'depo:selected'
export const SESSION_KEY_RESULTS = 'depo:results'
export const SESSION_KEY_OAUTH_STATE = 'depo:oauth_state'
