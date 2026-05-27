import { generateCommand } from '@/lib/generateCommand'

describe('generateCommand() — input validation', () => {
  it('throws on an owner containing a space', () => {
    expect(() => generateCommand('bad owner', ['repo'], 'gh')).toThrow('Invalid GitHub owner')
  })

  it('throws on an owner containing a semicolon', () => {
    expect(() => generateCommand('owner;rm -rf /', ['repo'], 'gh')).toThrow('Invalid GitHub owner')
  })

  it('throws on an owner containing a $( sequence', () => {
    expect(() => generateCommand('owner$(id)', ['repo'], 'gh')).toThrow('Invalid GitHub owner')
  })

  it('throws on a repo name containing a space (gh mode)', () => {
    expect(() => generateCommand('alice', ['bad repo'], 'gh')).toThrow('Invalid repository name: bad repo')
  })

  it('throws on a repo name containing a semicolon (gh mode)', () => {
    expect(() => generateCommand('alice', ['repo;rm -rf /'], 'gh')).toThrow('Invalid repository name: repo;rm -rf /')
  })

  it('throws on a repo name containing a $( sequence (gh mode)', () => {
    expect(() => generateCommand('alice', ['repo$(id)'], 'gh')).toThrow('Invalid repository name: repo$(id)')
  })

  it('throws on a repo name containing a space (curl mode)', () => {
    expect(() => generateCommand('alice', ['bad repo'], 'curl')).toThrow('Invalid repository name: bad repo')
  })

  it('throws on a repo name containing a semicolon (curl mode)', () => {
    expect(() => generateCommand('alice', ['repo;rm -rf /'], 'curl')).toThrow('Invalid repository name: repo;rm -rf /')
  })

  it('throws on a repo name containing a $( sequence (curl mode)', () => {
    expect(() => generateCommand('alice', ['repo$(id)'], 'curl')).toThrow('Invalid repository name: repo$(id)')
  })
})

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
