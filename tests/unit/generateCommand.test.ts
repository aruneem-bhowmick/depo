import { generateCommand } from '@/lib/generateCommand'

describe('generateCommand() — gh mode', () => {
  it('returns empty string for empty repos array', () => {
    expect(generateCommand('alice', [], 'gh')).toBe('')
  })

  it('generates one line per repo', () => {
    const result = generateCommand('alice', ['repo-a', 'repo-b'], 'gh')
    const lines = result.split('\n')
    expect(lines).toHaveLength(2)
  })

  it('uses gh repo delete owner/repo --yes format', () => {
    const result = generateCommand('alice', ['my-project'], 'gh')
    expect(result).toBe('gh repo delete alice/my-project --yes')
  })

  it('uses the owner from the first argument', () => {
    const result = generateCommand('bob', ['test-repo'], 'gh')
    expect(result).toContain('bob/test-repo')
  })

  it('handles three repos correctly', () => {
    const result = generateCommand('alice', ['a', 'b', 'c'], 'gh')
    expect(result).toBe(
      'gh repo delete alice/a --yes\n' +
      'gh repo delete alice/b --yes\n' +
      'gh repo delete alice/c --yes'
    )
  })
})

describe('generateCommand() — curl mode', () => {
  it('returns empty string for empty repos array', () => {
    expect(generateCommand('alice', [], 'curl')).toBe('')
  })

  it('starts with TOKEN="<your-token>"', () => {
    const result = generateCommand('alice', ['r'], 'curl')
    expect(result).toMatch(/^TOKEN="<your-token>"/)
  })

  it('contains a blank line after the TOKEN declaration', () => {
    const result = generateCommand('alice', ['r'], 'curl')
    const lines = result.split('\n')
    expect(lines[1]).toBe('')
  })

  it('includes the correct API endpoint for each repo', () => {
    const result = generateCommand('alice', ['my-repo'], 'curl')
    expect(result).toContain('https://api.github.com/repos/alice/my-repo')
  })

  it('uses -X DELETE method', () => {
    const result = generateCommand('alice', ['r'], 'curl')
    expect(result).toContain('-X DELETE')
  })

  it('uses Authorization: Bearer $TOKEN header', () => {
    const result = generateCommand('alice', ['r'], 'curl')
    expect(result).toContain('-H "Authorization: Bearer $TOKEN"')
  })

  it('uses -w to print http_code and repo name', () => {
    const result = generateCommand('alice', ['r'], 'curl')
    expect(result).toContain('-w "%{http_code}')
    expect(result).toContain(' r\\n"')
  })

  it('generates one curl block per repo', () => {
    const result = generateCommand('alice', ['a', 'b', 'c'], 'curl')
    const deleteCount = (result.match(/-X DELETE/g) ?? []).length
    expect(deleteCount).toBe(3)
  })
})
