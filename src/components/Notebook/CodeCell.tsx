import { useState, useCallback, useRef, useEffect } from 'react'
import MonacoEditor from '@monaco-editor/react'
import type { Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { HydratedCell } from '../../types'
import { CellOutput } from './CellOutput'
import styles from './CodeCell.module.css'

interface CodeCellProps {
  cell: HydratedCell
  onUpdateSource: (source: string) => void
  onRun: () => void
  onRunAndAdvance: () => void
  registerFocus: (fn: () => void) => void
  monacoTheme: string
  fontFamily: string
  fontSize: number
}

export function CodeCell({ cell, onUpdateSource, onRun, onRunAndAdvance, registerFocus, monacoTheme, fontFamily, fontSize }: CodeCellProps) {
  const minHeight = Math.ceil(fontSize * 1.5 * 3)
  const [height, setHeight] = useState(minHeight)

  const source = cell.source.join('')

  // Keep a ref to onRun so Monaco commands always call the latest version
  // without needing to re-register (addCommand is called once on mount).
  const onRunRef = useRef(onRun)
  useEffect(() => { onRunRef.current = onRun }, [onRun])

  const onRunAndAdvanceRef = useRef(onRunAndAdvance)
  useEffect(() => { onRunAndAdvanceRef.current = onRunAndAdvance }, [onRunAndAdvance])

  const handleMount = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      // Register focus callback so NotebookView can focus this cell programmatically
      registerFocus(() => editorInstance.focus())

      editorInstance.onDidContentSizeChange(() => {
        setHeight(Math.max(minHeight, Math.min(400, editorInstance.getContentHeight())))
      })

      // Set initial height
      setHeight(Math.max(minHeight, Math.min(400, editorInstance.getContentHeight())))

      // Cmd+Enter: run cell, stay
      editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => onRunRef.current())
      // Shift+Enter: run cell, advance to next
      editorInstance.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => onRunAndAdvanceRef.current())
    },
    [minHeight, registerFocus],
  )

  return (
    <div>
      <div className={styles.cell}>
        <div className={styles.gutter}>
          <button
            className={`${styles.runButton}${cell.isRunning ? ` ${styles.running}` : ''}`}
            onClick={onRun}
            disabled={false}
            aria-label={cell.isRunning ? 'Running…' : 'Run cell'}
            title="Run cell (Ctrl+Enter)"
          >
            {cell.isRunning ? (
              <span className={styles.spinner} />
            ) : (
              '▶'
            )}
          </button>
          <span className={styles.executionCount}>
            [{cell.executionCount ?? ' '}]:
          </span>
        </div>
        <div className={styles.editorWrapper} style={{ height: `${height}px` }}>
          <MonacoEditor
            language="python"
            theme={monacoTheme}
            value={source}
            onChange={(val) => onUpdateSource(val ?? '')}
            onMount={handleMount}
            options={{
              minimap: { enabled: false },
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontSize,
              fontFamily,
              padding: { top: 8, bottom: 8 },
              scrollbar: {
                verticalScrollbarSize: 6,
                horizontalScrollbarSize: 6,
                alwaysConsumeMouseWheel: false,
              },
              wordWrap: 'on',
              tabSize: 4,
              insertSpaces: true,
              overviewRulerLanes: 0,
            }}
            height={height}
          />
        </div>
      </div>
      <CellOutput outputs={cell.outputs} />
    </div>
  )
}
