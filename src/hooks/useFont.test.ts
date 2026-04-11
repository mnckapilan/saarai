import { renderHook, act } from '@testing-library/react'
import { useFont } from './useFont'
import { DEFAULT_FONT, MONO_FONTS } from '../constants/fonts'

const STORAGE_KEY = 'python-ide:font'

describe('useFont', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.removeProperty('--font-mono')
  })

  it('returns the default font when localStorage is empty', () => {
    const { result } = renderHook(() => useFont())
    expect(result.current.font).toEqual(DEFAULT_FONT)
  })

  it('restores a previously saved font from localStorage', () => {
    const saved = MONO_FONTS.find((f) => f.value !== DEFAULT_FONT.value)!
    localStorage.setItem(STORAGE_KEY, saved.value)
    const { result } = renderHook(() => useFont())
    expect(result.current.font.value).toBe(saved.value)
  })

  it('falls back to default when localStorage has an unrecognised value', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-real-font')
    const { result } = renderHook(() => useFont())
    expect(result.current.font).toEqual(DEFAULT_FONT)
  })

  it('persists the selected font to localStorage on change', () => {
    const { result } = renderHook(() => useFont())
    const newFont = MONO_FONTS.find((f) => f.value !== DEFAULT_FONT.value)!
    act(() => { result.current.setFont(newFont) })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(newFont.value)
  })

  it('updates the --font-mono CSS custom property on change', () => {
    const { result } = renderHook(() => useFont())
    const newFont = MONO_FONTS.find((f) => f.value !== DEFAULT_FONT.value)!
    act(() => { result.current.setFont(newFont) })
    expect(document.documentElement.style.getPropertyValue('--font-mono')).toBe(newFont.value)
  })

  it('exposes the full fonts list', () => {
    const { result } = renderHook(() => useFont())
    expect(result.current.fonts).toBe(MONO_FONTS)
  })
})
