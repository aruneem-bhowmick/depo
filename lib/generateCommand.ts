export type CommandMode = 'gh' | 'curl'

export function generateCommand(
  owner: string,
  repos: string[],
  mode: CommandMode,
): string {
  if (repos.length === 0) return ''

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
