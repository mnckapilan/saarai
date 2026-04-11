import { renderHook } from '@testing-library/react'
import { useKeyboardShortcut } from './useKeyboardShortcut'

describe('useKeyboardShortcut', () => {
  it('calls callback on exact key match', () => {
    const cb = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'Enter' }, cb))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(cb).toHaveBeenCalledOnce()
  })

  it('calls callback with metaKey when metaOrCtrl is true', () => {
    const cb = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'Enter', metaOrCtrl: true }, cb))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }))
    expect(cb).toHaveBeenCalledOnce()
  })

  it('calls callback with ctrlKey when metaOrCtrl is true', () => {
    const cb = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 's', metaOrCtrl: true }, cb))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))
    expect(cb).toHaveBeenCalledOnce()
  })

  it('does not call callback on wrong key', () => {
    const cb = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'Enter' }, cb))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    expect(cb).not.toHaveBeenCalled()
  })

  it('does not call callback when metaOrCtrl required but no modifier pressed', () => {
    const cb = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'Enter', metaOrCtrl: true }, cb))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(cb).not.toHaveBeenCalled()
  })

  it('removes the listener on unmount', () => {
    const cb = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcut({ key: 'Enter' }, cb))
    unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(cb).not.toHaveBeenCalled()
  })
})
