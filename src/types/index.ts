export type OutputLineType = 'stdout' | 'stderr' | 'info'

export interface OutputLine {
  type: OutputLineType
  text: string
  timestamp: number
}

export type PyodideStatus = 'loading' | 'ready' | 'running' | 'error'

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export interface HydratedCell {
  id: string                            // crypto.randomUUID(), never written to .ipynb
  cell_type: 'code' | 'markdown' | 'raw'
  source: string[]                      // lines as stored in .ipynb (each line ends with \n except last)
  metadata: Record<string, unknown>
  outputs: OutputLine[]                 // live runtime outputs, cleared on each run
  executionCount: number | null
  isRunning: boolean
}

export interface NotebookMeta {
  metadata: unknown
  nbformat: number
  nbformat_minor: number
}
