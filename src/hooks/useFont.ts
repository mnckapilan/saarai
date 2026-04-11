import { useEffect, useState } from 'react'
import { DEFAULT_FONT, MONO_FONTS, type FontOption } from '../constants/fonts'

const STORAGE_KEY = 'python-ide:font'

let preconnected = false

function ensureGoogleFontsPreconnect() {
  if (preconnected) return
  preconnected = true
  const origins = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ]
  origins.forEach((href) => {
    if (document.querySelector(`link[rel="preconnect"][href="${href}"]`)) return
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = href
    if (href.includes('gstatic')) link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  })
}

function loadGoogleFont(family: string) {
  ensureGoogleFontsPreconnect()
  const id = `gfont-${family}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;500&display=swap`
  document.head.appendChild(link)
}

function readStoredFont(): FontOption {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const match = MONO_FONTS.find((f) => f.value === stored)
      if (match) return match
    }
  } catch {
    // localStorage unavailable (private browsing, etc.)
  }
  return DEFAULT_FONT
}

export function useFont() {
  const [font, setFont] = useState<FontOption>(readStoredFont)

  useEffect(() => {
    // Persist selection
    try {
      localStorage.setItem(STORAGE_KEY, font.value)
    } catch {
      // ignore
    }

    // Load web font if needed
    if (font.googleFont) loadGoogleFont(font.googleFont)

    // Propagate to CSS custom property so OutputPanel updates automatically
    document.documentElement.style.setProperty('--font-mono', font.value)
  }, [font])

  return { font, setFont, fonts: MONO_FONTS }
}
