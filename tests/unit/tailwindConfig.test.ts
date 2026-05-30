import config from '@/config/tailwind.config'

// Tailwind's ResolvableTo types are too generic for direct property access,
// so we cast through unknown to reach the concrete shapes we know at runtime.
type KeyframeMap = Record<string, { transform: string }>
type AnimationMap = Record<string, string>

describe('tailwind.config', () => {
  it('uses class-based dark mode', () => {
    expect(config.darkMode).toBe('class')
  })

  it('defines the shake keyframes animation', () => {
    const keyframes = config.theme?.extend?.keyframes as unknown as Record<string, KeyframeMap>
    expect(keyframes?.shake).toBeDefined()
  })

  it('defines the shake animation shorthand', () => {
    const animation = config.theme?.extend?.animation as unknown as AnimationMap
    expect(animation?.shake).toContain('shake')
  })

  it('shake keyframes cover 0% and 100% reset positions', () => {
    const keyframes = config.theme?.extend?.keyframes as unknown as Record<string, KeyframeMap>
    expect(keyframes.shake['0%, 100%'].transform).toBe('translateX(0)')
  })

  it('shake keyframes include left and right offsets', () => {
    const keyframes = config.theme?.extend?.keyframes as unknown as Record<string, KeyframeMap>
    expect(keyframes.shake['20%, 60%'].transform).toContain('-6px')
    expect(keyframes.shake['40%, 80%'].transform).toContain('6px')
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
