import { useCallback, useEffect, useRef, useState } from 'react'
import type { HydratedCell, NotebookMeta, OutputLine, PyodideStatus } from '../types'
import { parseAndHydrate, serializeNotebook } from '../utils/ipynb'

interface UseNotebookProps {
  setCellOutputHandler: (fn: ((cellId: string, type: OutputLine['type'], text: string) => void) | null) => void
  setCellDoneHandler: (fn: ((cellId: string) => void) | null) => void
  runCellCode: (cellId: string, code: string, scriptDir?: string) => void
  status: PyodideStatus
}

interface UseNotebookReturn {
  cells: HydratedCell[]
  meta: NotebookMeta | null
  isDirty: boolean
  loadNotebook: (rawJson: string) => void
  serializeCurrentNotebook: () => string | null
  updateCellSource: (cellId: string, source: string[]) => void
  runCell: (cellId: string, scriptDir?: string) => void
  runAllCells: (scriptDir?: string) => void
  addCodeCellAfter: (cellId: string) => void
  addMarkdownCellAfter: (cellId: string) => void
  deleteCell: (cellId: string) => void
  moveCellUp: (cellId: string) => void
  moveCellDown: (cellId: string) => void
}

export function useNotebook({
  setCellOutputHandler,
  setCellDoneHandler,
  runCellCode,
  status,
}: UseNotebookProps): UseNotebookReturn {
  const [cells, setCells] = useState<HydratedCell[]>([])
  const [meta, setMeta] = useState<NotebookMeta | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Keep a ref to the latest cells so the cellDone handler (captured once) can see fresh state
  const cellsRef = useRef<HydratedCell[]>([])
  useEffect(() => {
    cellsRef.current = cells
  }, [cells])

  // Queue refs for sequential runAllCells
  const runQueueRef = useRef<string[]>([])
  const runScriptDirRef = useRef<string | undefined>(undefined)

  const drainQueue = useCallback(() => {
    const cellId = runQueueRef.current.shift()
    if (!cellId) return
    const cell = cellsRef.current.find((c) => c.id === cellId)
    if (!cell || cell.cell_type !== 'code') {
      // Skip non-code cells and continue
      drainQueue()
      return
    }
    setCells((prev) =>
      prev.map((c) => (c.id === cellId ? { ...c, outputs: [], isRunning: true } : c)),
    )
    runCellCode(cellId, cell.source.join(''), runScriptDirRef.current)
  }, [runCellCode])

  // Register output/done handlers when hook mounts, clear on unmount
  useEffect(() => {
    setCellOutputHandler((cellId, type, text) => {
      setCells((prev) =>
        prev.map((c) =>
          c.id === cellId
            ? { ...c, outputs: [...c.outputs, { type, text, timestamp: Date.now() } as OutputLine] }
            : c,
        ),
      )
    })
    setCellDoneHandler((cellId) => {
      setCells((prev) =>
        prev.map((c) => (c.id === cellId ? { ...c, isRunning: false, executionCount: (c.executionCount ?? 0) + 1 } : c)),
      )
      // Continue draining the queue after this cell finishes
      drainQueue()
    })
    return () => {
      setCellOutputHandler(null)
      setCellDoneHandler(null)
    }
  }, [setCellOutputHandler, setCellDoneHandler, drainQueue])

  const loadNotebook = useCallback((rawJson: string) => {
    const { cells: hydrated, meta: notebookMeta } = parseAndHydrate(rawJson)
    setCells(hydrated)
    setMeta(notebookMeta)
    setIsDirty(false)
  }, [])

  const serializeCurrentNotebook = useCallback((): string | null => {
    if (!meta) return null
    return serializeNotebook(meta, cells)
  }, [meta, cells])

  const updateCellSource = useCallback((cellId: string, source: string[]) => {
    setCells((prev) => prev.map((c) => (c.id === cellId ? { ...c, source } : c)))
    setIsDirty(true)
  }, [])

  const runCell = useCallback(
    (cellId: string, scriptDir?: string) => {
      if (status !== 'ready') return
      setCells((prev) =>
        prev.map((c) => (c.id === cellId ? { ...c, outputs: [], isRunning: true } : c)),
      )
      const cell = cells.find((c) => c.id === cellId)
      if (!cell || cell.cell_type !== 'code') return
      runCellCode(cellId, cell.source.join(''), scriptDir)
    },
    [status, cells, runCellCode],
  )

  const runAllCells = useCallback(
    (scriptDir?: string) => {
      if (status !== 'ready') return
      const codeIds = cellsRef.current
        .filter((c) => c.cell_type === 'code')
        .map((c) => c.id)
      if (codeIds.length === 0) return
      runQueueRef.current = codeIds
      runScriptDirRef.current = scriptDir
      drainQueue()
    },
    [status, drainQueue],
  )

  const addCodeCellAfter = useCallback((cellId: string) => {
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === cellId)
      const newCell: HydratedCell = {
        id: crypto.randomUUID(),
        cell_type: 'code',
        source: [],
        metadata: {},
        outputs: [],
        executionCount: null,
        isRunning: false,
      }
      const next = [...prev]
      next.splice(idx + 1, 0, newCell)
      return next
    })
    setIsDirty(true)
  }, [])

  const addMarkdownCellAfter = useCallback((cellId: string) => {
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === cellId)
      const newCell: HydratedCell = {
        id: crypto.randomUUID(),
        cell_type: 'markdown',
        source: [],
        metadata: {},
        outputs: [],
        executionCount: null,
        isRunning: false,
      }
      const next = [...prev]
      next.splice(idx + 1, 0, newCell)
      return next
    })
    setIsDirty(true)
  }, [])

  const deleteCell = useCallback((cellId: string) => {
    setCells((prev) => prev.filter((c) => c.id !== cellId))
    setIsDirty(true)
  }, [])

  const moveCellUp = useCallback((cellId: string) => {
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === cellId)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
    setIsDirty(true)
  }, [])

  const moveCellDown = useCallback((cellId: string) => {
    setCells((prev) => {
      const idx = prev.findIndex((c) => c.id === cellId)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
    setIsDirty(true)
  }, [])

  return {
    cells,
    meta,
    isDirty,
    loadNotebook,
    serializeCurrentNotebook,
    updateCellSource,
    runCell,
    runAllCells,
    addCodeCellAfter,
    addMarkdownCellAfter,
    deleteCell,
    moveCellUp,
    moveCellDown,
  }
}
