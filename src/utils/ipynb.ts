// Utilities for reading and writing Jupyter notebook (.ipynb) files.

import type { HydratedCell, NotebookMeta, OutputLine } from '../types'

interface RawNotebookCell {
  cell_type: string
  source: string[]
  metadata?: Record<string, unknown>
  outputs?: unknown[]
  execution_count?: number | null
  id?: string
}

interface RawNotebook {
  cells: RawNotebookCell[]
  metadata: unknown
  nbformat: number
  nbformat_minor: number
}

/**
 * Parse raw .ipynb JSON and hydrate cells with React state fields.
 * The id field is a client-only UUID — never stored in the .ipynb file.
 */
export function parseAndHydrate(json: string): { cells: HydratedCell[]; meta: NotebookMeta } {
  const nb = JSON.parse(json) as RawNotebook
  const cells: HydratedCell[] = (nb.cells ?? []).map((c) => ({
    id: crypto.randomUUID(),
    cell_type: c.cell_type as HydratedCell['cell_type'],
    source: c.source ?? [],
    metadata: c.metadata ?? {},
    outputs: [] as OutputLine[],
    executionCount: c.execution_count ?? null,
    isRunning: false,
  }))
  return {
    cells,
    meta: {
      metadata: nb.metadata,
      nbformat: nb.nbformat ?? 4,
      nbformat_minor: nb.nbformat_minor ?? 5,
    },
  }
}

/**
 * Extract Python source from code cells joined with blank line separators.
 * Used for MEMFS patching so sibling files can import notebook code.
 */
export function extractPython(cells: HydratedCell[]): string {
  return cells
    .filter((c) => c.cell_type === 'code')
    .map((c) => c.source.join(''))
    .join('\n\n')
}

/**
 * Serialize hydrated cells back to a valid .ipynb JSON string.
 * Strips client-only fields (id, outputs, isRunning) before writing.
 */
export function serializeNotebook(meta: NotebookMeta, cells: HydratedCell[]): string {
  const nb: RawNotebook = {
    metadata: meta.metadata,
    nbformat: meta.nbformat,
    nbformat_minor: meta.nbformat_minor,
    cells: cells.map((c) => ({
      cell_type: c.cell_type,
      source: c.source,
      metadata: c.metadata,
      outputs: [],
      execution_count: c.executionCount,
    })),
  }
  return JSON.stringify(nb, null, 1)
}

/**
 * Split a plain string into notebook source lines.
 * All lines except the last end with '\n'.
 */
export function toSourceLines(code: string): string[] {
  if (!code) return []
  const lines = code.split('\n')
  return lines.map((line, i) => (i < lines.length - 1 ? line + '\n' : line))
}
