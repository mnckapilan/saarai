import { renderHook, waitFor, act } from '@testing-library/react'
import { loadPyodide } from 'pyodide'
import { usePyodide } from './usePyodide'

vi.mock('pyodide', () => ({
  loadPyodide: vi.fn(),
}))

function makeMockPyodide() {
  return {
    runPython: vi.fn(),
    runPythonAsync: vi.fn().mockResolvedValue(undefined),
    globals: { set: vi.fn() },
    FS: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
    },
  }
}

describe('usePyodide', () => {
  let mockPy: ReturnType<typeof makeMockPyodide>

  beforeEach(() => {
    mockPy = makeMockPyodide()
    vi.mocked(loadPyodide).mockResolvedValue(mockPy as never)
  })

  afterEach(() => {
    vi.clearAllMocks()
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
    vi.mocked(loadPyodide).mockRejectedValueOnce(new Error('CDN error'))
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

    await act(async () => {
      await result.current.runCode('print("hello")')
    })

    expect(result.current.status).toBe('ready')
  })

  it('runCode clears previous output before running', async () => {
    mockPy.runPythonAsync.mockRejectedValueOnce(new Error('first error'))

    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => { await result.current.runCode('bad') })
    expect(result.current.output.length).toBeGreaterThan(0)

    await act(async () => { await result.current.runCode('print("hello")') })
    // output was cleared at the start of the second run; no stdout from mock
    expect(result.current.output).toEqual([])
  })

  it('runCode captures Python exceptions as stderr output', async () => {
    mockPy.runPythonAsync.mockRejectedValueOnce(new Error('NameError: x is not defined'))

    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => { await result.current.runCode('bad_code') })

    expect(result.current.output).toHaveLength(1)
    expect(result.current.output[0].type).toBe('stderr')
    expect(result.current.output[0].text).toContain('NameError')
    expect(result.current.status).toBe('ready')
  })

  it('clearOutput empties the output array', async () => {
    mockPy.runPythonAsync.mockRejectedValueOnce(new Error('err'))

    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(async () => { await result.current.runCode('x') })
    expect(result.current.output.length).toBeGreaterThan(0)

    act(() => { result.current.clearOutput() })
    expect(result.current.output).toEqual([])
  })

  it('mountFiles emits an info line with file count and working directory', async () => {
    const { result } = renderHook(() => usePyodide())
    await waitFor(() => expect(result.current.status).toBe('ready'))

    const files = new Map([['project/main.py', 'print("hi")']])
    await act(async () => {
      await result.current.mountFiles(files, '/project/project')
    })

    expect(result.current.output).toHaveLength(1)
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
    await act(async () => {
      await result.current.mountFiles(files, '/project/project')
    })

    expect(result.current.output[0].text).toContain('2 files')
  })
})
