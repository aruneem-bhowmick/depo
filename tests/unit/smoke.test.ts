describe('bootstrap smoke test', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('jest and jest-dom are configured correctly', () => {
    const el = document.createElement('div')
    el.textContent = 'hello'
    document.body.appendChild(el)
    expect(el).toBeInTheDocument()
    expect(el).toHaveTextContent('hello')
  })
})
