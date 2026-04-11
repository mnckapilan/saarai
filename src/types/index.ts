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
