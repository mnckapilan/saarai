import { useEffect } from 'react'

interface Shortcut {
  key: string
  /** Matches Cmd on Mac, Ctrl on Windows/Linux */
  metaOrCtrl?: boolean
}

export function useKeyboardShortcut(shortcut: Shortcut, callback: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const modifierMatch = shortcut.metaOrCtrl
        ? e.metaKey || e.ctrlKey
        : true

      if (e.key === shortcut.key && modifierMatch) {
        e.preventDefault()
        callback()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcut.key, shortcut.metaOrCtrl, callback])
}
