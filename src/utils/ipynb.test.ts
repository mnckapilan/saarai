import { describe, it, expect } from 'vitest'
import { parseAndHydrate, extractPython, serializeNotebook, toSourceLines } from './ipynb'
import type { HydratedCell, NotebookMeta } from '../types'

const MINIMAL_NB = JSON.stringify({
  nbformat: 4,
  nbformat_minor: 5,
  metadata: { kernelspec: { name: 'python3' } },
  cells: [
    {
      cell_type: 'markdown',
      source: ['# Hello\n', 'World'],
      metadata: {},
      outputs: [],
      execution_count: null,
    },
    {
      cell_type: 'code',
      source: ["print('hello')\n", 'x = 1'],
      metadata: {},
      outputs: [],
      execution_count: 1,
    },
    {
      cell_type: 'code',
      source: ['print(x)'],
      metadata: {},
      outputs: [],
      execution_count: 2,
    },
  ],
})

describe('parseAndHydrate', () => {
  it('returns the correct number of cells', () => {
    const { cells } = parseAndHydrate(MINIMAL_NB)
    expect(cells).toHaveLength(3)
  })

  it('each cell has a unique id in uuid format', () => {
    const { cells } = parseAndHydrate(MINIMAL_NB)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    for (const cell of cells) {
      expect(cell.id).toMatch(uuidRegex)
    }
    const ids = cells.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cell_type is preserved correctly for each cell', () => {
    const { cells } = parseAndHydrate(MINIMAL_NB)
    expect(cells[0].cell_type).toBe('markdown')
    expect(cells[1].cell_type).toBe('code')
    expect(cells[2].cell_type).toBe('code')
  })

  it('source arrays are preserved', () => {
    const { cells } = parseAndHydrate(MINIMAL_NB)
    expect(cells[0].source).toEqual(['# Hello\n', 'World'])
    expect(cells[1].source).toEqual(["print('hello')\n", 'x = 1'])
    expect(cells[2].source).toEqual(['print(x)'])
  })

  it('outputs is [] for all cells (cleared on hydration)', () => {
    const { cells } = parseAndHydrate(MINIMAL_NB)
    for (const cell of cells) {
      expect(cell.outputs).toEqual([])
    }
  })

  it('executionCount is preserved from the raw cell', () => {
    const { cells } = parseAndHydrate(MINIMAL_NB)
    expect(cells[0].executionCount).toBeNull()
    expect(cells[1].executionCount).toBe(1)
    expect(cells[2].executionCount).toBe(2)
  })

  it('isRunning is false for all cells', () => {
    const { cells } = parseAndHydrate(MINIMAL_NB)
    for (const cell of cells) {
      expect(cell.isRunning).toBe(false)
    }
  })

  it('meta has correct nbformat, nbformat_minor, and metadata object', () => {
    const { meta } = parseAndHydrate(MINIMAL_NB)
    expect(meta.nbformat).toBe(4)
    expect(meta.nbformat_minor).toBe(5)
    expect(meta.metadata).toEqual({ kernelspec: { name: 'python3' } })
  })

  it('calling twice produces different ids (randomness)', () => {
    const { cells: cells1 } = parseAndHydrate(MINIMAL_NB)
    const { cells: cells2 } = parseAndHydrate(MINIMAL_NB)
    const ids1 = cells1.map((c) => c.id)
    const ids2 = cells2.map((c) => c.id)
    expect(ids1).not.toEqual(ids2)
  })
})

describe('extractPython', () => {
  it('only extracts code cells (skips markdown)', () => {
    const { cells } = parseAndHydrate(MINIMAL_NB)
    const result = extractPython(cells)
    expect(result).not.toContain('# Hello')
    expect(result).not.toContain('World')
  })

  it('joins cell sources correctly (each cell lines joined, cells separated by \\n\\n)', () => {
    const { cells } = parseAndHydrate(MINIMAL_NB)
    const result = extractPython(cells)
    expect(result).toBe("print('hello')\nx = 1\n\nprint(x)")
  })

  it('returns empty string when no code cells', () => {
    const nbJson = JSON.stringify({
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {},
      cells: [
        {
          cell_type: 'markdown',
          source: ['# Only markdown'],
          metadata: {},
          outputs: [],
          execution_count: null,
        },
      ],
    })
    const { cells } = parseAndHydrate(nbJson)
    expect(extractPython(cells)).toBe('')
  })

  it('returns empty string for empty cells array', () => {
    expect(extractPython([])).toBe('')
  })
})

describe('serializeNotebook', () => {
  function getSerializedAndParsed(meta: NotebookMeta, cells: HydratedCell[]) {
    const json = serializeNotebook(meta, cells)
    return JSON.parse(json)
  }

  it('output is valid JSON', () => {
    const { cells, meta } = parseAndHydrate(MINIMAL_NB)
    expect(() => JSON.parse(serializeNotebook(meta, cells))).not.toThrow()
  })

  it('cells are in correct order', () => {
    const { cells, meta } = parseAndHydrate(MINIMAL_NB)
    const parsed = getSerializedAndParsed(meta, cells)
    expect(parsed.cells[0].cell_type).toBe('markdown')
    expect(parsed.cells[1].cell_type).toBe('code')
    expect(parsed.cells[2].cell_type).toBe('code')
  })

  it('id field is NOT present in output cells (client-only)', () => {
    const { cells, meta } = parseAndHydrate(MINIMAL_NB)
    const parsed = getSerializedAndParsed(meta, cells)
    for (const cell of parsed.cells) {
      expect(cell).not.toHaveProperty('id')
    }
  })

  it('isRunning is NOT present in output cells', () => {
    const { cells, meta } = parseAndHydrate(MINIMAL_NB)
    const parsed = getSerializedAndParsed(meta, cells)
    for (const cell of parsed.cells) {
      expect(cell).not.toHaveProperty('isRunning')
    }
  })

  it('outputs is always [] in serialized output', () => {
    const { cells, meta } = parseAndHydrate(MINIMAL_NB)
    // Add a runtime output to a cell
    const cellsWithOutput = cells.map((c) =>
      c.cell_type === 'code'
        ? { ...c, outputs: [{ type: 'stdout' as const, text: 'hello', timestamp: 1 }] }
        : c,
    )
    const parsed = getSerializedAndParsed(meta, cellsWithOutput)
    for (const cell of parsed.cells) {
      expect(cell.outputs).toEqual([])
    }
  })

  it('execution_count is preserved', () => {
    const { cells, meta } = parseAndHydrate(MINIMAL_NB)
    const parsed = getSerializedAndParsed(meta, cells)
    expect(parsed.cells[0].execution_count).toBeNull()
    expect(parsed.cells[1].execution_count).toBe(1)
    expect(parsed.cells[2].execution_count).toBe(2)
  })

  it('cell_type is preserved', () => {
    const { cells, meta } = parseAndHydrate(MINIMAL_NB)
    const parsed = getSerializedAndParsed(meta, cells)
    expect(parsed.cells[0].cell_type).toBe('markdown')
    expect(parsed.cells[1].cell_type).toBe('code')
    expect(parsed.cells[2].cell_type).toBe('code')
  })

  it('source is preserved', () => {
    const { cells, meta } = parseAndHydrate(MINIMAL_NB)
    const parsed = getSerializedAndParsed(meta, cells)
    expect(parsed.cells[0].source).toEqual(['# Hello\n', 'World'])
    expect(parsed.cells[1].source).toEqual(["print('hello')\n", 'x = 1'])
    expect(parsed.cells[2].source).toEqual(['print(x)'])
  })

  it('metadata, nbformat, nbformat_minor are preserved from NotebookMeta', () => {
    const { cells, meta } = parseAndHydrate(MINIMAL_NB)
    const parsed = getSerializedAndParsed(meta, cells)
    expect(parsed.nbformat).toBe(4)
    expect(parsed.nbformat_minor).toBe(5)
    expect(parsed.metadata).toEqual({ kernelspec: { name: 'python3' } })
  })

  it('markdown cells are preserved in output', () => {
    const { cells, meta } = parseAndHydrate(MINIMAL_NB)
    const parsed = getSerializedAndParsed(meta, cells)
    expect(parsed.cells[0].cell_type).toBe('markdown')
    expect(parsed.cells[0].source).toEqual(['# Hello\n', 'World'])
  })
})

describe('toSourceLines', () => {
  it('empty string returns []', () => {
    expect(toSourceLines('')).toEqual([])
  })

  it('single line without newline returns array with that line', () => {
    expect(toSourceLines('hello')).toEqual(['hello'])
  })

  it('multiple lines — each except last ends with \\n', () => {
    const result = toSourceLines('line1\nline2\nline3')
    expect(result).toEqual(['line1\n', 'line2\n', 'line3'])
  })

  it('already-newline-terminated string is handled correctly', () => {
    // 'hello\n' splits into ['hello', ''] — last element is '' (no extra \n)
    const result = toSourceLines('hello\n')
    expect(result).toEqual(['hello\n', ''])
  })
})
