import { OutputLine } from '../../types'
import styles from './CellOutput.module.css'

interface CellOutputProps {
  outputs: OutputLine[]
}

export function CellOutput({ outputs }: CellOutputProps) {
  if (outputs.length === 0) return null

  return (
    <div className={styles.output} role="log" aria-label="Cell output">
      {outputs.map((line, i) => (
        <div key={i} className={`${styles.line} ${styles[line.type]}`}>
          {line.text}
        </div>
      ))}
    </div>
  )
}
