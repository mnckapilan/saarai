import { useEffect, useState } from 'react'

const STORAGE_KEY = 'python-ide:fontSize'
const DEFAULT_SIZE = 14
const MIN_SIZE = 10
const MAX_SIZE = 24

function readStoredSize(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const n = parseInt(stored, 10)
      if (!isNaN(n) && n >= MIN_SIZE && n <= MAX_SIZE) return n
    }
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_SIZE
}

export function useFontSize() {
  const [fontSize, setFontSizeState] = useState<number>(readStoredSize)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(fontSize))
    } catch {
      // ignore
    }
  }, [fontSize])

  function setFontSize(n: number) {
    setFontSizeState(Math.min(MAX_SIZE, Math.max(MIN_SIZE, n)))
  }

  return { fontSize, setFontSize, min: MIN_SIZE, max: MAX_SIZE }
}
