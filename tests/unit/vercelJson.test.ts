import vercelJson from '@/vercel.json'

describe('vercel.json', () => {
  it('sets maxDuration 60 for the delete route', () => {
    expect(vercelJson.functions['app/api/delete/route.ts'].maxDuration).toBe(60)
  })

  it('does not set maxDuration for other routes', () => {
    const keys = Object.keys(vercelJson.functions)
    expect(keys).toHaveLength(1)
    expect(keys[0]).toBe('app/api/delete/route.ts')
  })
})
