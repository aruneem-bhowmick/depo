/** Mandatory delay between sequential repository deletions (ms). Keeps Depo within GitHub's secondary rate limits for destructive operations. */
export const DELETION_DELAY_MS = 150

/** Maximum number of repositories that can be selected for a single deletion batch. Prevents an accidental full-account wipe in one action. */
export const MAX_BATCH_SIZE = 100

/** sessionStorage key holding the JSON-serialised string[] of selected repo names, written by /repos and read by /confirm. */
export const SESSION_KEY_SELECTED = 'depo:selected'

/** sessionStorage key holding the JSON-serialised DeletionResult[] written by /confirm after deletion and read by /done. */
export const SESSION_KEY_RESULTS = 'depo:results'

/** sessionStorage key holding the CSRF state nonce written before the OAuth redirect and validated by /api/auth/callback. */
export const SESSION_KEY_OAUTH_STATE = 'depo:oauth_state'
