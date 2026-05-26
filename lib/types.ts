export interface Repo {
  id: number
  name: string          // e.g. "my-project"
  fullName: string      // e.g. "username/my-project"
  description: string | null
  fork: boolean
  stargazerCount: number
  updatedAt: string | null
  url: string           // GitHub web URL
  visibility: 'public' | 'private'
}

export interface DeletionResult {
  repo: string          // repo name only (not fullName)
  status: 'deleted' | 'error'
  error?: string        // present only when status === 'error'
}

export interface SessionData {
  accessToken: string
  login: string         // GitHub username
  avatarUrl: string
}
