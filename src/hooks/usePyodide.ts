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

  // scriptDir: the MEMFS directory of the file being run (e.g. "/project/myproject/src").
  // Python adds the script's own directory to sys.path[0] when you run a file normally;
  // we replicate that behaviour so that sibling-module imports work correctly.
  const runCode = useCallback(
    async (code: string, scriptDir?: string) => {
      const pyodide = pyodideRef.current
      if (!pyodide || status !== 'ready') return

      setStatus('running')
      setOutput([])

      try {
        // Ensure the script's directory is on sys.path (mirrors `python script.py` behaviour)
        // and invalidate the importer cache so newly written MEMFS files are visible.
        pyodide.globals.set('_script_dir', scriptDir ?? '')
        pyodide.runPython(`
import sys, importlib
_sd = _script_dir
if _sd and _sd not in sys.path:
    sys.path.insert(0, _sd)
# Evict user-project modules so edits are picked up without remounting.
_stale = [k for k, v in sys.modules.items()
          if getattr(getattr(v, '__spec__', None), 'origin', None)
          and v.__spec__.origin.startswith('/project/')]
for _k in _stale:
    del sys.modules[_k]
importlib.invalidate_caches()
del _sd, _stale, _script_dir
`.trim())

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

  // Write a single file into MEMFS without remounting the whole project.
  // Called after save so that the next run sees the saved content.
  const patchFile = useCallback((memfsPath: string, content: string) => {
    const pyodide = pyodideRef.current
    if (!pyodide) return
    try {
      const dirPath = memfsPath.substring(0, memfsPath.lastIndexOf('/'))
      mkdirP(pyodide, dirPath)
      pyodide.FS.writeFile(memfsPath, content, { encoding: 'utf8' })
    } catch (err) {
      console.error('Failed to patch file in MEMFS:', err)
    }
  }, [])

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

      // Set cwd, add it to sys.path, and flush Python's importer caches so
      // newly written MEMFS files are discoverable on the next import.
      // Without invalidate_caches(), sys.path_importer_cache retains a
      // pre-mount snapshot and raises ModuleNotFoundError even when the file
      // is physically present.
      pyodide.globals.set('_mount_cwd', cwd)
      pyodide.runPython(`
import os, sys, importlib
os.chdir(_mount_cwd)
if _mount_cwd not in sys.path:
    sys.path.insert(0, _mount_cwd)
importlib.invalidate_caches()
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

  return { status, output, runCode, clearOutput, mountFiles, patchFile }
}
