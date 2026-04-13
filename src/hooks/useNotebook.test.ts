import { renderHook, act, waitFor } from '@testing-library/react'
import { useNotebook } from './useNotebook'

const mockRunCellCode = vi.fn()
const mockSetCellOutputHandler = vi.fn()
const mockSetCellDoneHandler = vi.fn()

const defaultProps = {
  setCellOutputHandler: mockSetCellOutputHandler,
  setCellDoneHandler: mockSetCellDoneHandler,
  runCellCode: mockRunCellCode,
  status: 'ready' as const,
}

const SIMPLE_NB = JSON.stringify({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: {},
  cells: [
    { cell_type: 'code', source: ['print("a")'], metadata: {}, outputs: [], execution_count: null },
    { cell_type: 'markdown', source: ['# title'], metadata: {}, outputs: [], execution_count: null },
    { cell_type: 'code', source: ['print("b")'], metadata: {}, outputs: [], execution_count: null },
  ],
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNotebook', () => {
  it('initial state: cells is [], meta is null, isDirty is false', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    expect(result.current.cells).toEqual([])
    expect(result.current.meta).toBeNull()
    expect(result.current.isDirty).toBe(false)
  })

  it('loadNotebook: cells length is 3', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    expect(result.current.cells).toHaveLength(3)
  })

  it('loadNotebook: isDirty stays false after load', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    expect(result.current.isDirty).toBe(false)
  })

  it('loadNotebook: meta is set correctly', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    expect(result.current.meta).not.toBeNull()
    expect(result.current.meta?.nbformat).toBe(4)
    expect(result.current.meta?.nbformat_minor).toBe(5)
  })

  it('updateCellSource: updates the right cell source and sets isDirty true', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const cellId = result.current.cells[0].id
    act(() => { result.current.updateCellSource(cellId, ['updated source']) })
    expect(result.current.cells[0].source).toEqual(['updated source'])
    expect(result.current.isDirty).toBe(true)
  })

  it('deleteCell: removes the cell by id and sets isDirty true', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const cellId = result.current.cells[1].id
    act(() => { result.current.deleteCell(cellId) })
    expect(result.current.cells).toHaveLength(2)
    expect(result.current.cells.find((c) => c.id === cellId)).toBeUndefined()
    expect(result.current.isDirty).toBe(true)
  })

  it('addCodeCellAfter: inserts a new code cell after the given id with empty source and sets isDirty true', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const firstId = result.current.cells[0].id
    act(() => { result.current.addCodeCellAfter(firstId) })
    expect(result.current.cells).toHaveLength(4)
    const newCell = result.current.cells[1]
    expect(newCell.cell_type).toBe('code')
    expect(newCell.source).toEqual([])
    expect(result.current.isDirty).toBe(true)
  })

  it('addMarkdownCellAfter: inserts a new markdown cell after given id', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const firstId = result.current.cells[0].id
    act(() => { result.current.addMarkdownCellAfter(firstId) })
    expect(result.current.cells).toHaveLength(4)
    const newCell = result.current.cells[1]
    expect(newCell.cell_type).toBe('markdown')
    expect(result.current.isDirty).toBe(true)
  })

  it('moveCellUp: swaps cell with the one above it', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const secondCellId = result.current.cells[1].id
    const firstCellId = result.current.cells[0].id
    act(() => { result.current.moveCellUp(secondCellId) })
    expect(result.current.cells[0].id).toBe(secondCellId)
    expect(result.current.cells[1].id).toBe(firstCellId)
    expect(result.current.isDirty).toBe(true)
  })

  it('moveCellUp: does nothing for first cell', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const originalOrder = result.current.cells.map((c) => c.id)
    const firstCellId = result.current.cells[0].id
    act(() => { result.current.moveCellUp(firstCellId) })
    expect(result.current.cells.map((c) => c.id)).toEqual(originalOrder)
  })

  it('moveCellDown: swaps cell with the one below it', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const firstCellId = result.current.cells[0].id
    const secondCellId = result.current.cells[1].id
    act(() => { result.current.moveCellDown(firstCellId) })
    expect(result.current.cells[0].id).toBe(secondCellId)
    expect(result.current.cells[1].id).toBe(firstCellId)
    expect(result.current.isDirty).toBe(true)
  })

  it('moveCellDown: does nothing for last cell', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const originalOrder = result.current.cells.map((c) => c.id)
    const lastCellId = result.current.cells[2].id
    act(() => { result.current.moveCellDown(lastCellId) })
    expect(result.current.cells.map((c) => c.id)).toEqual(originalOrder)
  })

  it('serializeCurrentNotebook: returns null when meta is null', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    expect(result.current.serializeCurrentNotebook()).toBeNull()
  })

  it('serializeCurrentNotebook: returns valid JSON string after loadNotebook', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const json = result.current.serializeCurrentNotebook()
    expect(json).not.toBeNull()
    expect(() => JSON.parse(json!)).not.toThrow()
  })

  it('runCell: calls runCellCode with the cell id and joined source', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const codeCell = result.current.cells.find((c) => c.cell_type === 'code')!
    act(() => { result.current.runCell(codeCell.id) })
    expect(mockRunCellCode).toHaveBeenCalledWith(codeCell.id, codeCell.source.join(''), undefined)
  })

  it('runCell: does NOT call runCellCode if status is not ready', () => {
    const { result } = renderHook(() =>
      useNotebook({ ...defaultProps, status: 'running' }),
    )
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const codeCell = result.current.cells.find((c) => c.cell_type === 'code')!
    act(() => { result.current.runCell(codeCell.id) })
    expect(mockRunCellCode).not.toHaveBeenCalled()
  })

  it('runCell: marks the cell as isRunning=true', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const codeCell = result.current.cells.find((c) => c.cell_type === 'code')!
    act(() => { result.current.runCell(codeCell.id) })
    const updatedCell = result.current.cells.find((c) => c.id === codeCell.id)!
    expect(updatedCell.isRunning).toBe(true)
  })

  it('runCell: clears cell outputs before running', () => {
    const { result } = renderHook(() => useNotebook(defaultProps))
    act(() => { result.current.loadNotebook(SIMPLE_NB) })
    const codeCell = result.current.cells.find((c) => c.cell_type === 'code')!
    // Manually set some outputs by triggering the cell output handler
    const outputHandler = mockSetCellOutputHandler.mock.calls[0][0] as
      | ((cellId: string, type: string, text: string) => void)
      | null
    if (outputHandler) {
      act(() => { outputHandler(codeCell.id, 'stdout', 'previous output') })
    }
    act(() => { result.current.runCell(codeCell.id) })
    const updatedCell = result.current.cells.find((c) => c.id === codeCell.id)!
    expect(updatedCell.outputs).toEqual([])
  })

  it('setCellOutputHandler was called once on mount', async () => {
    renderHook(() => useNotebook(defaultProps))
    await waitFor(() => expect(mockSetCellOutputHandler).toHaveBeenCalledOnce())
  })

  it('setCellDoneHandler was called once on mount', async () => {
    renderHook(() => useNotebook(defaultProps))
    await waitFor(() => expect(mockSetCellDoneHandler).toHaveBeenCalledOnce())
  })

  it('on unmount: setCellOutputHandler called with null, setCellDoneHandler called with null', async () => {
    const { unmount } = renderHook(() => useNotebook(defaultProps))
    await waitFor(() => expect(mockSetCellOutputHandler).toHaveBeenCalledOnce())
    unmount()
    expect(mockSetCellOutputHandler).toHaveBeenLastCalledWith(null)
    expect(mockSetCellDoneHandler).toHaveBeenLastCalledWith(null)
  })
})
