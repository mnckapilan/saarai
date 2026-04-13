import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { HydratedCell } from '../../types'
import styles from './MarkdownCell.module.css'

interface MarkdownCellProps {
  cell: HydratedCell
  onUpdateSource: (source: string) => void
  fontFamily: string
  fontSize: number
}

export function MarkdownCell({ cell, onUpdateSource }: MarkdownCellProps) {
  const [editing, setEditing] = useState(false)
  const source = cell.source.join('')
  const [draft, setDraft] = useState(source)

  const enterEdit = useCallback(() => {
    setDraft(cell.source.join(''))
    setEditing(true)
  }, [cell.source])

  const commitEdit = useCallback(() => {
    onUpdateSource(draft)
    setEditing(false)
  }, [draft, onUpdateSource])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault()
        commitEdit()
      }
    },
    [commitEdit],
  )

  if (editing) {
    return (
      <textarea
        className={styles.editTextarea}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitEdit}
        onKeyDown={handleKeyDown}
        autoFocus
        aria-label="Edit markdown cell"
      />
    )
  }

  return (
    <div
      className={styles.viewContainer}
      onClick={enterEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') enterEdit()
      }}
      aria-label="Markdown cell — click to edit"
    >
      {source.trim() ? (
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {source}
        </ReactMarkdown>
      ) : (
        <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
          Click to edit markdown…
        </span>
      )}
    </div>
  )
}
