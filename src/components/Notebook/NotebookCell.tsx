import { HydratedCell } from '../../types'
import { CodeCell } from './CodeCell'
import { MarkdownCell } from './MarkdownCell'
import styles from './NotebookCell.module.css'

interface NotebookCellProps {
  cell: HydratedCell
  onUpdateSource: (source: string) => void
  onRun: () => void
  onDelete: () => void
  onAddCodeAfter: () => void
  onAddMarkdownAfter: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  monacoTheme: string
  fontFamily: string
  fontSize: number
}

export function NotebookCell({
  cell,
  onUpdateSource,
  onRun,
  onDelete,
  onAddCodeAfter,
  onAddMarkdownAfter,
  onMoveUp,
  onMoveDown,
  monacoTheme,
  fontFamily,
  fontSize,
}: NotebookCellProps) {
  return (
    <div className={styles.cellWrapper}>
      <div className={styles.actions}>
        <button
          className={styles.actionButton}
          onClick={onMoveUp}
          aria-label="Move cell up"
          title="Move cell up"
        >
          ↑
        </button>
        <button
          className={styles.actionButton}
          onClick={onMoveDown}
          aria-label="Move cell down"
          title="Move cell down"
        >
          ↓
        </button>
        <button
          className={`${styles.actionButton} ${styles.deleteButton}`}
          onClick={onDelete}
          aria-label="Delete cell"
          title="Delete cell"
        >
          ✕ Delete
        </button>
        <button
          className={styles.actionButton}
          onClick={onAddCodeAfter}
          aria-label="Add code cell below"
          title="Add code cell below"
        >
          + Code
        </button>
        <button
          className={styles.actionButton}
          onClick={onAddMarkdownAfter}
          aria-label="Add markdown cell below"
          title="Add markdown cell below"
        >
          + Markdown
        </button>
      </div>

      {cell.cell_type === 'code' ? (
        <CodeCell
          cell={cell}
          onUpdateSource={onUpdateSource}
          onRun={onRun}
          monacoTheme={monacoTheme}
          fontFamily={fontFamily}
          fontSize={fontSize}
        />
      ) : (
        <MarkdownCell
          cell={cell}
          onUpdateSource={onUpdateSource}
          fontFamily={fontFamily}
          fontSize={fontSize}
        />
      )}
    </div>
  )
}
