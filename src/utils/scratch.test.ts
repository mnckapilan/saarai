import { SCRATCH_KEY, clearScratch, loadScratch, saveScratch } from './scratch'

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe('scratch persistence', () => {
  it('round-trips a saved state', () => {
    const state = {
      files: [['untitled.py', 'print(1)'], ['pkg/a.py', 'x = 1']] as [string, string][],
      emptyDirs: ['empty'],
      active: 'pkg/a.py',
    }
    saveScratch(state)
    expect(loadScratch()).toEqual(state)
  })

  it('removes the key when saving empty files and emptyDirs', () => {
    saveScratch({ files: [['a.py', '']], emptyDirs: [], active: null })
    expect(localStorage.getItem(SCRATCH_KEY)).not.toBeNull()
    saveScratch({ files: [], emptyDirs: [], active: null })
    expect(localStorage.getItem(SCRATCH_KEY)).toBeNull()
  })

  it('persists a state with only empty dirs', () => {
    saveScratch({ files: [], emptyDirs: ['d'], active: null })
    expect(loadScratch()).toEqual({ files: [], emptyDirs: ['d'], active: null })
  })

  it('clearScratch removes the key', () => {
    saveScratch({ files: [['a.py', '']], emptyDirs: [], active: 'a.py' })
    clearScratch()
    expect(localStorage.getItem(SCRATCH_KEY)).toBeNull()
    expect(loadScratch()).toBeNull()
  })

  it('returns null when the key is missing', () => {
    expect(loadScratch()).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    localStorage.setItem(SCRATCH_KEY, '{not json')
    expect(loadScratch()).toBeNull()
  })

  it('returns null when files is not an array', () => {
    localStorage.setItem(SCRATCH_KEY, JSON.stringify({ files: 'nope', emptyDirs: [] }))
    expect(loadScratch()).toBeNull()
  })

  it('filters malformed file and emptyDir entries', () => {
    localStorage.setItem(
      SCRATCH_KEY,
      JSON.stringify({
        files: [['ok.py', 'x'], ['bad.py'], [1, 'x'], ['n.py', 2], 'str', null],
        emptyDirs: ['d', 3, null],
        active: 'ok.py',
      }),
    )
    expect(loadScratch()).toEqual({ files: [['ok.py', 'x']], emptyDirs: ['d'], active: 'ok.py' })
  })

  it('returns null when everything is filtered out', () => {
    localStorage.setItem(SCRATCH_KEY, JSON.stringify({ files: [['bad']], emptyDirs: [] }))
    expect(loadScratch()).toBeNull()
  })

  it('nulls out an active path that is not among files', () => {
    localStorage.setItem(
      SCRATCH_KEY,
      JSON.stringify({ files: [['a.py', '']], emptyDirs: [], active: 'gone.py' }),
    )
    expect(loadScratch()?.active).toBeNull()
  })

  it('nulls out a non-string active', () => {
    localStorage.setItem(
      SCRATCH_KEY,
      JSON.stringify({ files: [['a.py', '']], emptyDirs: [], active: 5 }),
    )
    expect(loadScratch()?.active).toBeNull()
  })

  it('defaults emptyDirs to [] when missing', () => {
    localStorage.setItem(SCRATCH_KEY, JSON.stringify({ files: [['a.py', '']] }))
    expect(loadScratch()).toEqual({ files: [['a.py', '']], emptyDirs: [], active: null })
  })
})
