import MonacoEditor, { type OnMount, type Monaco } from '@monaco-editor/react'
import { loader } from '@monaco-editor/react'
import { useCallback, useMemo } from 'react'
import styles from './Editor.module.css'

// Load Monaco from CDN — keeps the npm bundle lean and avoids
// the complex worker setup required when bundling Monaco with Vite.
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.50.0/min/vs',
  },
})

type MonacoOptions = React.ComponentProps<typeof MonacoEditor>['options']

const BASE_EDITOR_OPTIONS: MonacoOptions = {
  fontSize: 14,
  lineHeight: 22,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  lineNumbers: 'on',
  renderLineHighlight: 'all',
  tabSize: 4,
  insertSpaces: true,
  wordWrap: 'on',
  automaticLayout: true,
  padding: { top: 16, bottom: 16 },
  scrollbar: {
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
  },
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  renderLineHighlightOnlyWhenFocus: false,
}

interface EditorProps {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  fontFamily: string
  fontLigatures: boolean
}

export function Editor({ value, onChange, onRun, fontFamily, fontLigatures }: EditorProps) {
  const handleChange = useCallback(
    (val: string | undefined) => onChange(val ?? ''),
    [onChange],
  )

  const options = useMemo<MonacoOptions>(
    () => ({ ...BASE_EDITOR_OPTIONS, fontFamily, fontLigatures }),
    [fontFamily, fontLigatures],
  )

  // Register Cmd/Ctrl+Enter inside Monaco so the shortcut works when
  // the editor is focused (Monaco captures keyboard events internally).
  const handleMount: OnMount = useCallback(
    (editor, monaco: Monaco) => {
      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        onRun,
      )
    },
    [onRun],
  )

  return (
    <div className={styles.container}>
      <MonacoEditor
        language="python"
        theme="vs-dark"
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        options={options}
      />
    </div>
  )
}
