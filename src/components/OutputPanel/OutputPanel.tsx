import { useEffect, useRef } from 'react'
import { OutputLine } from '../../types'
import styles from './OutputPanel.module.css'

interface OutputPanelProps {
  output: OutputLine[]
  onClear: () => void
}

export function OutputPanel({ output, onClear }: OutputPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [output])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Output</span>
        {output.length > 0 && (
          <button
            className={styles.clearButton}
            onClick={onClear}
            aria-label="Clear output"
          >
            Clear
          </button>
        )}
      </div>

      <div className={styles.content} role="log" aria-label="Program output">
        {output.length === 0 ? (
          <p className={styles.placeholder}>
            Run your code to see output here…
          </p>
        ) : (
          output.map((line, i) => (
            <div key={i} className={`${styles.line} ${styles[line.type]}`}>
              {line.text}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
