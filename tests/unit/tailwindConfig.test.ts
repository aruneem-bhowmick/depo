import config from '@/config/tailwind.config'

describe('tailwind.config', () => {
  it('uses class-based dark mode', () => {
    expect(config.darkMode).toBe('class')
  })

  it('defines the shake keyframes animation', () => {
    expect(config.theme?.extend?.keyframes?.shake).toBeDefined()
  })

  it('defines the shake animation shorthand', () => {
    expect(config.theme?.extend?.animation?.shake).toContain('shake')
  })

  it('shake keyframes cover 0% and 100% reset positions', () => {
    const shake = config.theme?.extend?.keyframes?.shake as Record<string, { transform: string }>
    expect(shake['0%, 100%'].transform).toBe('translateX(0)')
  })

  it('shake keyframes include left and right offsets', () => {
    const shake = config.theme?.extend?.keyframes?.shake as Record<string, { transform: string }>
    expect(shake['20%, 60%'].transform).toContain('-6px')
    expect(shake['40%, 80%'].transform).toContain('6px')
  })

  it('includes app and components directories in content paths', () => {
    const content = config.content as string[]
    expect(content.some(p => p.includes('./app/**'))).toBe(true)
    expect(content.some(p => p.includes('./components/**'))).toBe(true)
  })

  it('has no additional plugins', () => {
    expect(config.plugins).toHaveLength(0)
  })
})
