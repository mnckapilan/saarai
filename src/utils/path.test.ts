import { joinPath, parentOf } from './path'

describe('parentOf', () => {
  it('returns empty string for a top-level file', () => {
    expect(parentOf('untitled.py')).toBe('')
  })

  it('returns the directory for a nested file', () => {
    expect(parentOf('a/b.py')).toBe('a')
    expect(parentOf('a/b/c.py')).toBe('a/b')
  })

  it('does not truncate a top-level name (regression: untitled.p/new.py)', () => {
    const renamed = joinPath(parentOf('untitled.py'), 'new.py')
    expect(renamed).toBe('new.py')
    expect(renamed).not.toContain('untitled.p')
  })
})

describe('joinPath', () => {
  it('omits the leading slash at the top level', () => {
    expect(joinPath('', 'x.py')).toBe('x.py')
  })

  it('joins parent and name with a slash', () => {
    expect(joinPath('a', 'x.py')).toBe('a/x.py')
    expect(joinPath('a/b', 'x.py')).toBe('a/b/x.py')
  })
})
