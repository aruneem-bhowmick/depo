import { Octokit } from '@octokit/rest'
import type { Repo } from './types'

export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token })
}

export async function listPublicRepos(token: string): Promise<Repo[]> {
  const octokit = createOctokit(token)
  const raw = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
    type: 'owner',
    visibility: 'public',
    sort: 'updated',
    direction: 'desc',
    per_page: 100,
  })
  return raw.map(r => ({
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    description: r.description ?? null,
    fork: r.fork,
    stargazerCount: r.stargazers_count ?? 0,
    updatedAt: r.updated_at ?? new Date().toISOString(),
    url: r.html_url,
    visibility: (r.visibility ?? 'public') as 'public' | 'private',
  }))
}
