import { HydratedCell, PyodideStatus } from '../../types'
import { toSourceLines } from '../../utils/ipynb'
import { NotebookCell } from './NotebookCell'
import styles from './NotebookView.module.css'

interface NotebookViewProps {
  cells: HydratedCell[]
  pyodideStatus: PyodideStatus
  monacoTheme: string
  fontFamily: string
  fontSize: number
  onUpdateSource: (cellId: string, source: string[]) => void
  onRunCell: (cellId: string) => void
  onDeleteCell: (cellId: string) => void
  onAddCodeAfter: (cellId: string) => void
  onAddMarkdownAfter: (cellId: string) => void
  onRunAll: () => void
  onMoveCellUp: (cellId: string) => void
  onMoveCellDown: (cellId: string) => void
}

const STATUS_LABELS: Record<PyodideStatus, string> = {
  loading: 'Loading Python…',
  ready: 'Ready',
  running: 'Running…',
  error: 'Error',
}

const STATUS_CLASS: Record<PyodideStatus, string> = {
  loading: styles.statusLoading,
  ready: styles.statusReady,
  running: styles.statusRunning,
  error: styles.statusError,
}

export function NotebookView({
  cells,
  pyodideStatus,
  monacoTheme,
  fontFamily,
  fontSize,
  onUpdateSource,
  onRunCell,
  onDeleteCell,
  onAddCodeAfter,
  onAddMarkdownAfter,
  onRunAll,
  onMoveCellUp,
  onMoveCellDown,
}: NotebookViewProps) {
  // Add a new code cell at the end (after the last cell if any)
  const lastCellId = cells.length > 0 ? cells[cells.length - 1].id : ''

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button
          className={styles.runAllButton}
          onClick={onRunAll}
          disabled={pyodideStatus !== 'ready'}
          aria-label="Run all cells"
          title="Run all cells"
        >
          ▶▶ Run All
        </button>
        <span className={`${styles.statusIndicator} ${STATUS_CLASS[pyodideStatus]}`}>
          {STATUS_LABELS[pyodideStatus]}
        </span>
      </div>

      <div className={styles.scrollArea}>
        {cells.map((cell) => (
          <NotebookCell
            key={cell.id}
            cell={cell}
            onUpdateSource={(rawSource: string) =>
              onUpdateSource(cell.id, toSourceLines(rawSource))
            }
            onRun={() => onRunCell(cell.id)}
            onDelete={() => onDeleteCell(cell.id)}
            onAddCodeAfter={() => onAddCodeAfter(cell.id)}
            onAddMarkdownAfter={() => onAddMarkdownAfter(cell.id)}
            onMoveUp={() => onMoveCellUp(cell.id)}
            onMoveDown={() => onMoveCellDown(cell.id)}
            monacoTheme={monacoTheme}
            fontFamily={fontFamily}
            fontSize={fontSize}
          />
        ))}
      </div>

      <div className={styles.footer}>
        <button
          className={styles.addCellButton}
          onClick={() => lastCellId ? onAddCodeAfter(lastCellId) : onAddCodeAfter('')}
          aria-label="Add code cell"
        >
          + Add code cell
        </button>
      </div>
    </div>
  )
}
