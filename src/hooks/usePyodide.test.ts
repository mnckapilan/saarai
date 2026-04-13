import { renderHook, waitFor, act } from '@testing-library/react'
import { usePyodide } from './usePyodide'

// ── Configurable mock worker ──────────────────────────────────────────────────
// vi.hoisted runs before module evaluation, making these values available
// inside the vi.mock factory even though vi.mock calls are hoisted.
const { mockBehavior } = vi.hoisted(() => {
  const mockBehavior = {
    initError: false,
    // If set, the mock sends this text as a stderr line before 'done'.
    runError: '',
    // If non-empty, the mock sends a filesWritten message before 'done'.
    writtenFiles: [] as [string, string][],
  }
  return { mockBehavior }
})

vi.mock('../pyodide.worker?worker', () => ({
  default: class MockWorker {
    onmessage: ((e: MessageEvent) => void) | null = null

    _dispatch(data: object) {
      // Use setTimeout so state updates land inside act() / waitFor() correctly.
      setTimeout(() => this.onmessage?.({ data } as MessageEvent), 0)
    }

    postMessage(msg: { type: string; files?: [string, string][]; cwd?: string }) {
      switch (msg.type) {
        case 'init':
          if (mockBehavior.initError) {
            this._dispatch({ type: 'error', message: 'CDN error' })
          } else {
            this._dispatch({ type: 'ready' })
          }
          break
        case 'run':
          if (mockBehavior.runError) {
            this._dispatch({ type: 'stderr', text: mockBehavior.runError })
          }
          if (mockBehavior.writtenFiles.length > 0) {
            this._dispatch({ type: 'filesWritten', files: mockBehavior.writtenFiles })
          }
          this._dispatch({ type: 'done' })
          break
        case 'mountFiles':
          this._dispatch({
            type: 'mounted',
            count: msg.files?.length ?? 0,
            cwd: msg.cwd ?? '',
          })
          break
      }
    }

    terminate() {}
  },
}))

// ─────────────────────────────────────────────────────────────────────────────

describe('usePyodide', () => {
  beforeEach(() => {
    mockBehavior.initError = false
    mockBehavior.runError = ''
    mockBehavior.writtenFiles = []
  })

  it('starts in loading state', () => {
    const { result } = renderHook(() => usePyodide())
    expect(result.current.status).toBe('loading')
  })

  it('transitions to ready after Pyodide loads', async () => {
    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('transitions to error when Pyodide fails to load', async () => {
    mockBehavior.initError = true
    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('starts with an empty output array', () => {
    const { result } = renderHook(() => usePyodide())
    expect(result.current.output).toEqual([])
  })

  it('runCode returns to ready status after successful execution', async () => {
    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => { result.current.runCode('print("hello")') })
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('runCode clears previous output before running', async () => {
    mockBehavior.runError = 'SyntaxError: first error'
    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => { result.current.runCode('bad') })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.output.length).toBeGreaterThan(0)

    mockBehavior.runError = ''
    act(() => { result.current.runCode('print("hello")') })
    // Output is cleared synchronously at the start of each run.
    await waitFor(() => expect(result.current.status).toBe('ready'))
    // No stdout from mock, so output is empty after second run.
    expect(result.current.output).toEqual([])
  })

  it('runCode captures Python exceptions as stderr output', async () => {
    mockBehavior.runError = 'NameError: x is not defined'
    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => { result.current.runCode('bad_code') })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.output).toHaveLength(1)
    expect(result.current.output[0].type).toBe('stderr')
    expect(result.current.output[0].text).toContain('NameError')
  })

  it('clearOutput empties the output array', async () => {
    mockBehavior.runError = 'err'
    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => { result.current.runCode('x') })
    await waitFor(() => expect(result.current.output.length).toBeGreaterThan(0))

    act(() => { result.current.clearOutput() })
    expect(result.current.output).toEqual([])
  })

  it('mountFiles emits an info line with file count and working directory', async () => {
    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    const files = new Map([['project/main.py', 'print("hi")']])
    act(() => { result.current.mountFiles(files, '/project/project') })

    await waitFor(() => expect(result.current.output).toHaveLength(1))
    expect(result.current.output[0].type).toBe('info')
    expect(result.current.output[0].text).toContain('1 file')
    expect(result.current.output[0].text).toContain('/project/project')
  })

  it('mountFiles uses plural "files" for multiple files', async () => {
    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    const files = new Map([
      ['project/main.py', 'pass'],
      ['project/utils.py', 'pass'],
    ])
    act(() => { result.current.mountFiles(files, '/project/project') })
    await waitFor(() => expect(result.current.output).toHaveLength(1))
    expect(result.current.output[0].text).toContain('2 files')
  })

  it('writtenFiles is null initially', () => {
    const { result } = renderHook(() => usePyodide())
    expect(result.current.writtenFiles).toBeNull()
  })

  it('writtenFiles is populated when the worker reports files written during a run', async () => {
    mockBehavior.writtenFiles = [['/project/myproject/output.txt', 'hello']]
    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => { result.current.runCode('open("output.txt", "w").write("hello")') })
    await waitFor(() => expect(result.current.writtenFiles).not.toBeNull())

    expect(result.current.writtenFiles).toEqual([['/project/myproject/output.txt', 'hello']])
  })

  it('writtenFiles is not set when no files are written during a run', async () => {
    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => { result.current.runCode('print("hello")') })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.writtenFiles).toBeNull()
  })
})
