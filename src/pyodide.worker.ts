import type { PyodideInterface } from 'pyodide'

// Pyodide WASM files are loaded from CDN. Version must match the npm package.
const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'

type InMessage =
  | { type: 'init'; interruptBuffer: Uint8Array | null }
  | { type: 'run'; code: string; scriptDir?: string; scriptPath?: string }
  | { type: 'mountFiles'; files: [string, string][]; cwd: string }
  | { type: 'patchFile'; path: string; content: string }
  | { type: 'runCell'; cellId: string; code: string; scriptDir?: string }

type OutMessage =
  | { type: 'ready' }
  | { type: 'stdout'; text: string; cellId?: string }
  | { type: 'stderr'; text: string; cellId?: string }
  | { type: 'done' }
  | { type: 'cellDone'; cellId: string }
  | { type: 'mounted'; count: number; cwd: string }
  | { type: 'error'; message: string }
  | { type: 'filesWritten'; files: [string, string][] }

function post(msg: OutMessage) {
  self.postMessage(msg)
}

// Strip Pyodide internals from Python tracebacks so users only see frames
// that relate to their own code.
//
// Raw errors look like:
//   PythonError: Traceback (most recent call last):
//     File "/lib/python312.zip/_pyodide/_base.py", line 597, in eval_code_async
//       await CodeRunner(
//     File "<exec>", line 3, in <module>
//       foo()
//   ValueError: oops
//
// After formatting:
//   Traceback (most recent call last):
//     File "<exec>", line 3, in <module>
//       foo()
//   ValueError: oops
function formatPythonError(err: unknown): string {
  const raw = String(err)
  // Strip the JS-level "PythonError: " wrapper added by Pyodide
  const text = raw.startsWith('PythonError: ') ? raw.slice(13) : raw

  const lines = text.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    // Detect an internal Pyodide frame header: '  File "/lib/.../  _pyodide/...'
    if (/^\s+File ".*\/_pyodide\//.test(line)) {
      i++
      // Skip the associated source/caret lines that belong to this frame
      // (they don't start a new frame or a bare exception name)
      while (
        i < lines.length &&
        lines[i] !== '' &&
        !/^\s+File "/.test(lines[i]) &&
        !/^\w/.test(lines[i])
      ) {
        i++
      }
    } else {
      out.push(line)
      i++
    }
  }

  // Strip the MEMFS mount prefix so paths show as "myproject/main.py"
  // instead of "/project/myproject/main.py".
  const cleaned = out.join('\n').replace(/File "\/project\//g, 'File "')

  // If every frame was internal the header is now orphaned — remove it.
  // "Traceback (most recent call last):\nSomeError" → "SomeError"
  const result = cleaned.replace(/^Traceback \(most recent call last\):\s*\n(?=\w)/, '')

  return result.trim()
}

let activeCellId: string | null = null

let pyodide: PyodideInterface | null = null
// Messages received before Pyodide finishes loading are queued and replayed.
const queue: InMessage[] = []

// Snapshot of /project/ MEMFS contents taken after each mount or run, used to
// detect files created or modified by Python code during a run.
let mountedSnapshot = new Map<string, string>()

function scanMemFS(): Map<string, string> {
  const result = new Map<string, string>()
  function walk(dir: string) {
    let entries: string[]
    try {
      entries = pyodide!.FS.readdir(dir) as string[]
    } catch {
      return
    }
    for (const name of entries) {
      if (name === '.' || name === '..') continue
      const full = `${dir}/${name}`
      try {
        const stat = pyodide!.FS.stat(full)
        if (pyodide!.FS.isDir(stat.mode)) {
          walk(full)
        } else {
          const content = pyodide!.FS.readFile(full, { encoding: 'utf8' }) as string
          result.set(full, content)
        }
      } catch {
        // skip unreadable or binary files
      }
    }
  }
  walk('/project')
  return result
}

function mkdirP(path: string) {
  const parts = path.split('/').filter(Boolean)
  let current = ''
  for (const part of parts) {
    current += '/' + part
    try {
      pyodide!.FS.mkdir(current)
    } catch {
      // EEXIST — already exists, ignore
    }
  }
}

async function handleMessage(msg: InMessage) {
  switch (msg.type) {
    case 'run': {
      const { code, scriptDir, scriptPath } = msg
      try {
        // Mirror `python script.py` behaviour: add the script's directory to
        // sys.path[0] and evict stale user-project modules so edits are seen.
        pyodide!.globals.set('_script_dir', scriptDir ?? '')
        pyodide!.runPython(`
import sys, importlib
_sd = _script_dir
if _sd and _sd not in sys.path:
    sys.path.insert(0, _sd)
_stale = [k for k, v in sys.modules.items()
          if getattr(getattr(v, '__spec__', None), 'origin', None)
          and v.__spec__.origin.startswith('/project/')]
for _k in _stale:
    del sys.modules[_k]
importlib.invalidate_caches()
del _sd, _stale, _script_dir
`.trim())
        // Pass the MEMFS path as filename so Python tracebacks show the real
        // file name and can read source lines from MEMFS for display.
        // Falls back to '<stdin>' when running a selection or scratch code.
        await pyodide!.runPythonAsync(code, { filename: scriptPath ?? '<stdin>' })
      } catch (err) {
        post({ type: 'stderr', text: formatPythonError(err) })
      }
      // Detect files created or modified by the Python run.
      const current = scanMemFS()
      const written: [string, string][] = []
      for (const [path, content] of current) {
        if (content !== mountedSnapshot.get(path)) {
          written.push([path, content])
        }
      }
      mountedSnapshot = current
      if (written.length > 0) {
        post({ type: 'filesWritten', files: written })
      }
      post({ type: 'done' })
      break
    }

    case 'runCell': {
      const { cellId, code, scriptDir } = msg
      activeCellId = cellId
      try {
        pyodide!.globals.set('_script_dir', scriptDir ?? '')
        pyodide!.runPython(`
import sys, importlib
_sd = _script_dir
if _sd and _sd not in sys.path:
    sys.path.insert(0, _sd)
_stale = [k for k, v in sys.modules.items()
          if getattr(getattr(v, '__spec__', None), 'origin', None)
          and v.__spec__.origin.startswith('/project/')]
for _k in _stale:
    del sys.modules[_k]
importlib.invalidate_caches()
del _sd, _stale, _script_dir
`.trim())
        await pyodide!.runPythonAsync(code, { filename: `<cell:${cellId}>` })
      } catch (err) {
        post({ type: 'stderr', text: formatPythonError(err), cellId })
      } finally {
        activeCellId = null
        post({ type: 'cellDone', cellId })
      }
      break
    }

    case 'mountFiles': {
      const contents = new Map(msg.files)
      const { cwd } = msg
      try {
        pyodide!.runPython(`
import shutil, os
if os.path.exists('/project'):
    shutil.rmtree('/project')
os.makedirs('/project')
`.trim())
        for (const [path, content] of contents) {
          const fullPath = `/project/${path}`
          const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'))
          mkdirP(dirPath)
          pyodide!.FS.writeFile(fullPath, content, { encoding: 'utf8' })
        }
        pyodide!.globals.set('_mount_cwd', cwd)
        pyodide!.runPython(`
import os, sys, importlib
os.chdir(_mount_cwd)
if _mount_cwd not in sys.path:
    sys.path.insert(0, _mount_cwd)
importlib.invalidate_caches()
del _mount_cwd
`.trim())
        mountedSnapshot = scanMemFS()
        post({ type: 'mounted', count: contents.size, cwd })
      } catch (err) {
        console.error('Worker: failed to mount files:', err)
      }
      break
    }

    case 'patchFile': {
      const { path, content } = msg
      try {
        const dirPath = path.substring(0, path.lastIndexOf('/'))
        mkdirP(dirPath)
        pyodide!.FS.writeFile(path, content, { encoding: 'utf8' })
      } catch (err) {
        console.error('Worker: failed to patch file:', err)
      }
      break
    }
  }
}

self.onmessage = async (e: MessageEvent<InMessage>) => {
  const msg = e.data

  if (msg.type === 'init') {
    try {
      const { loadPyodide } = await import('pyodide')
      pyodide = await loadPyodide({
        indexURL: PYODIDE_INDEX_URL,
        stdout: (text: string) => post({ type: 'stdout', text, cellId: activeCellId ?? undefined }),
        stderr: (text: string) => post({ type: 'stderr', text, cellId: activeCellId ?? undefined }),
      })
      if (msg.interruptBuffer) {
        pyodide.setInterruptBuffer(msg.interruptBuffer)
      }
      post({ type: 'ready' })
      // Drain any messages that arrived while Pyodide was loading.
      for (const pending of queue) {
        await handleMessage(pending)
      }
      queue.length = 0
    } catch (err) {
      post({ type: 'error', message: String(err) })
    }
    return
  }

  if (!pyodide) {
    queue.push(msg)
    return
  }

  await handleMessage(msg)
}
