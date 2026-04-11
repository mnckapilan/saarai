import { useCallback, useEffect, useRef, useState } from 'react'
import type { PyodideInterface } from 'pyodide'
import { OutputLine, PyodideStatus } from '../types'

// Pyodide WASM files are loaded from CDN to avoid bundling ~10MB of assets.
// This version must match the installed npm package version.
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

export function usePyodide() {
  const pyodideRef = useRef<PyodideInterface | null>(null)
  const [status, setStatus] = useState<PyodideStatus>('loading')
  const [output, setOutput] = useState<OutputLine[]>([])

  const appendOutput = (type: OutputLine['type'], text: string) => {
    setOutput((prev) => [...prev, { type, text, timestamp: Date.now() }])
  }

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const { loadPyodide } = await import('pyodide')
        const pyodide = await loadPyodide({
          indexURL: PYODIDE_INDEX_URL,
          stdout: (text: string) => {
            if (!cancelled) appendOutput('stdout', text)
          },
          stderr: (text: string) => {
            if (!cancelled) appendOutput('stderr', text)
          },
        })
        if (!cancelled) {
          pyodideRef.current = pyodide
          setStatus('ready')
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to initialise Pyodide:', err)
          setStatus('error')
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const runCode = useCallback(
    async (code: string) => {
      const pyodide = pyodideRef.current
      if (!pyodide || status !== 'ready') return

      setStatus('running')
      setOutput([])

      try {
        await pyodide.runPythonAsync(code)
      } catch (err) {
        // PythonError includes the full Python traceback in its message
        setOutput((prev) => [
          ...prev,
          { type: 'stderr', text: String(err), timestamp: Date.now() },
        ])
      } finally {
        setStatus('ready')
      }
    },
    [status],
  )

  const clearOutput = useCallback(() => setOutput([]), [])

  return { status, output, runCode, clearOutput }
}
