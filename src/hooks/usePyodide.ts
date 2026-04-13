import { useCallback, useEffect, useRef, useState } from 'react'
import { OutputLine, PyodideStatus } from '../types'
import PyodideWorker from '../pyodide.worker?worker'

export function usePyodide() {
  const workerRef = useRef<Worker | null>(null)
  const interruptBufferRef = useRef<Uint8Array | null>(null)
  const [status, setStatus] = useState<PyodideStatus>('loading')
  const [output, setOutput] = useState<OutputLine[]>([])

  const appendOutput = useCallback((type: OutputLine['type'], text: string) => {
    setOutput((prev) => [...prev, { type, text, timestamp: Date.now() }])
  }, [])

  const initWorker = useCallback(() => {
    const worker = new PyodideWorker()
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data
      switch (msg.type) {
        case 'ready':
          setStatus('ready')
          break
        case 'stdout':
          appendOutput('stdout', msg.text)
          break
        case 'stderr':
          appendOutput('stderr', msg.text)
          break
        case 'done':
          setStatus('ready')
          break
        case 'mounted':
          appendOutput(
            'info',
            `Mounted ${msg.count} file${msg.count !== 1 ? 's' : ''} — working directory: ${msg.cwd}`,
          )
          break
        case 'error':
          console.error('Pyodide worker error:', msg.message)
          setStatus('error')
          break
      }
    }

    // SharedArrayBuffer requires cross-origin isolation (COOP + COEP headers).
    // When available, it enables low-overhead interrupt via Atomics.store().
    let interruptBuffer: Uint8Array | null = null
    if (typeof SharedArrayBuffer !== 'undefined') {
      interruptBuffer = new Uint8Array(new SharedArrayBuffer(1))
    }
    interruptBufferRef.current = interruptBuffer
    worker.postMessage({ type: 'init', interruptBuffer })
  }, [appendOutput])

  useEffect(() => {
    initWorker()
    return () => {
      workerRef.current?.terminate()
    }
  }, [initWorker])

  const runCode = useCallback(
    async (code: string, scriptDir?: string) => {
      if (!workerRef.current || status !== 'ready') return

      // Reset any pending interrupt flag before starting a new run.
      const buf = interruptBufferRef.current
      if (buf) Atomics.store(buf, 0, 0)

      setStatus('running')
      setOutput([])
      workerRef.current.postMessage({ type: 'run', code, scriptDir })
    },
    [status],
  )

  const interrupt = useCallback(() => {
    const buf = interruptBufferRef.current
    if (buf) {
      // Signal Pyodide to raise KeyboardInterrupt between Python opcodes.
      Atomics.store(buf, 0, 2)
    } else {
      // Fallback when SharedArrayBuffer is unavailable: terminate the worker.
      // MEMFS state is lost; the user will need to re-open their project files.
      workerRef.current?.terminate()
      setStatus('loading')
      setOutput([
        {
          type: 'info',
          text: 'Execution stopped. Runtime is restarting — please re-open your project files.',
          timestamp: Date.now(),
        },
      ])
      initWorker()
    }
  }, [initWorker])

  const clearOutput = useCallback(() => setOutput([]), [])

  // Post a mountFiles message to the worker. The worker queues it if Pyodide
  // is still loading and processes it once ready, so no polling is needed here.
  const mountFiles = useCallback(async (contents: Map<string, string>, cwd: string) => {
    if (!workerRef.current) return
    workerRef.current.postMessage({
      type: 'mountFiles',
      files: Array.from(contents.entries()),
      cwd,
    })
  }, [])

  const patchFile = useCallback((memfsPath: string, content: string) => {
    if (!workerRef.current) return
    workerRef.current.postMessage({ type: 'patchFile', path: memfsPath, content })
  }, [])

  return { status, output, runCode, interrupt, clearOutput, mountFiles, patchFile }
}
