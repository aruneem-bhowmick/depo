export type CommandMode = 'gh' | 'curl'

const OWNER_RE = /^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$/
const REPO_RE = /^[A-Za-z0-9._-]+$/

export function generateCommand(
  owner: string,
  repos: string[],
  mode: CommandMode,
): string {
  if (repos.length === 0) return ''
  if (!OWNER_RE.test(owner)) throw new Error('Invalid GitHub owner')
  for (const repo of repos) {
    if (!REPO_RE.test(repo)) throw new Error(`Invalid repository name: ${repo}`)
  }

  if (mode === 'gh') {
    const lines = repos.map(r => `gh repo delete ${owner}/${r} --yes`)
    return lines.join('\n')
  }

  // curl mode — uses placeholder token
  const lines = [
    `TOKEN="<your-token>"`,
    ``,
    ...repos.map(r =>
      `curl -s -o /dev/null -w "%{http_code} ${r}\\n" \\\n` +
      `  -X DELETE \\\n` +
      `  -H "Authorization: Bearer $TOKEN" \\\n` +
      `  https://api.github.com/repos/${owner}/${r}`
    ),
  ]
  return lines.join('\n')
}
