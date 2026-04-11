import { useCallback, useEffect, useRef, useState } from 'react'
import type { PyodideInterface } from 'pyodide'
import { OutputLine, PyodideStatus } from '../types'

// Pyodide WASM files are loaded from CDN to avoid bundling ~10MB of assets.
// This version must match the installed npm package version.
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

// Create a directory and all missing ancestors in Pyodide's MEMFS.
function mkdirP(pyodide: PyodideInterface, path: string) {
  const parts = path.split('/').filter(Boolean)
  let current = ''
  for (const part of parts) {
    current += '/' + part
    try {
      pyodide.FS.mkdir(current)
    } catch {
      // EEXIST — directory already exists, ignore
    }
  }
}

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

  // Write a set of files into Pyodide's MEMFS under /project/ and set the
  // Python working directory so that relative imports and open() calls work.
  //
  // contents: path → text content  (e.g. "myproject/utils/helper.py" → "...")
  // cwd:      absolute MEMFS path to chdir into (e.g. "/project/myproject")
  //
  // If Pyodide is still loading, this waits up to 30 s before giving up.
  const mountFiles = useCallback(async (contents: Map<string, string>, cwd: string) => {
    // Wait for Pyodide to finish loading if necessary
    if (!pyodideRef.current) {
      await new Promise<void>((resolve) => {
        const check = setInterval(() => {
          if (pyodideRef.current) {
            clearInterval(check)
            resolve()
          }
        }, 100)
        setTimeout(() => {
          clearInterval(check)
          resolve()
        }, 30_000)
      })
    }

    const pyodide = pyodideRef.current
    if (!pyodide) return

    try {
      // Wipe any previous project mount and recreate the base directory
      pyodide.runPython(`
import shutil, os
if os.path.exists('/project'):
    shutil.rmtree('/project')
os.makedirs('/project')
`.trim())

      // Write every file, creating parent directories as needed
      for (const [path, content] of contents) {
        const fullPath = `/project/${path}`
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'))
        mkdirP(pyodide, dirPath)
        pyodide.FS.writeFile(fullPath, content, { encoding: 'utf8' })
      }

      // Set the Python working directory and ensure it's on sys.path
      pyodide.globals.set('_mount_cwd', cwd)
      pyodide.runPython(`
import os, sys
os.chdir(_mount_cwd)
if _mount_cwd not in sys.path:
    sys.path.insert(0, _mount_cwd)
del _mount_cwd
`.trim())

      const n = contents.size
      setOutput((prev) => [
        ...prev,
        {
          type: 'info',
          text: `Mounted ${n} file${n !== 1 ? 's' : ''} — working directory: ${cwd}`,
          timestamp: Date.now(),
        },
      ])
    } catch (err) {
      console.error('Failed to mount files into Pyodide FS:', err)
    }
  }, [])

  return { status, output, runCode, clearOutput, mountFiles }
}
