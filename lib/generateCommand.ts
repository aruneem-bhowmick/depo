/** Output format for the generated shell deletion script. */
export type CommandMode = 'gh' | 'curl'

const OWNER_RE = /^[A-Za-z0-9](?:-?[A-Za-z0-9]){0,38}$/
const REPO_RE = /^[A-Za-z0-9._-]+$/

/**
 * Generates a ready-to-paste shell script for deleting GitHub repositories.
 *
 * In `'gh'` mode each repo becomes a `gh repo delete owner/repo --yes` line.
 * In `'curl'` mode a `TOKEN` placeholder variable is emitted first, followed
 * by one curl DELETE block per repo that prints the HTTP status code next to
 * the repo name, making failures immediately visible.
 *
 * @param owner - GitHub username who owns the repositories. Must satisfy
 *   the pattern `[A-Za-z0-9](-?[A-Za-z0-9]){0,38}`.
 * @param repos - Short repository names to include (not full `owner/repo` strings).
 *   Each must satisfy `[A-Za-z0-9._-]+`.
 * @param mode - Output format: `'gh'` for GitHub CLI or `'curl'` for raw HTTP.
 * @returns Multi-line shell script string, or `''` when `repos` is empty.
 * @throws {Error} If `owner` or any repo name fails format validation.
 */
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
