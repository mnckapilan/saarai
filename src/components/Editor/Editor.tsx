import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import MonacoEditor, { type OnMount, type Monaco } from '@monaco-editor/react'
import { loader } from '@monaco-editor/react'
import * as monacoEditor from 'monaco-editor'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import styles from './Editor.module.css'

// Wire Monaco's web worker. We only need the base editor worker since
// Python has no built-in Monaco language server.
window.MonacoEnvironment = {
  getWorker() {
    return new EditorWorker()
  },
}

// Use the locally installed monaco-editor instead of loading from CDN.
loader.config({ monaco: monacoEditor })

// Expose Monaco globally so devtools and tests can inspect editor state.
;(window as unknown as { monaco: typeof monacoEditor }).monaco = monacoEditor

type MonacoOptions = React.ComponentProps<typeof MonacoEditor>['options']

const BASE_EDITOR_OPTIONS: MonacoOptions = {
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
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  stickyScroll: { enabled: true },
  bracketPairColorization: { enabled: true, independentColorPoolPerBracketType: false },
  guides: { indentation: true, bracketPairs: true, highlightActiveBracketPair: true },
  renderWhitespace: 'selection',
  hover: { enabled: true, delay: 300, sticky: true },
}

/** Imperative handle exposed to the parent via ref. */
export interface EditorHandle {
  /** Dispose the Monaco model for a given file path, freeing its undo history. */
  disposeModel(filePath: string): void
  /** Returns the currently selected text, or null if the selection is empty. */
  getSelectedText(): string | null
  /** Overwrite the content of an existing model (e.g. after reload-from-disk). */
  setModelValue(filePath: string, content: string): void
}

interface EditorProps {
  /**
   * Content to seed a newly-created model with. When filePath is set this is
   * used only once (on model creation); subsequent content changes are driven
   * by the model itself.
   */
  value: string
  /**
   * The active file path. When set, enables multi-model mode: each distinct
   * path gets its own ITextModel, preserving undo/cursor/scroll across switches.
   */
  filePath?: string | null
  onChange: (value: string) => void
  onRun: () => void
  onSelectionChange?: (hasSelection: boolean) => void
  onCursorPositionChange?: (line: number, col: number) => void
  monacoTheme: 'vs-dark' | 'vs'
  fontFamily: string
  fontLigatures: boolean
  fontSize: number
  bracketColorization: boolean
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { value, filePath, onChange, onRun, onSelectionChange, onCursorPositionChange, monacoTheme, fontFamily, fontLigatures, fontSize, bracketColorization },
  ref,
) {
  const editorRef = useRef<monacoEditor.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const modelsRef = useRef<Map<string, monacoEditor.editor.ITextModel>>(new Map())
  const viewStatesRef = useRef<Map<string, monacoEditor.editor.ICodeEditorViewState>>(new Map())
  const activePathRef = useRef<string | null>(null)
  const changeSubRef = useRef<monacoEditor.IDisposable | null>(null)

  // Stable refs so that callbacks registered once (e.g. in handleMount) always
  // call the latest versions without needing to re-register.
  const onRunRef = useRef(onRun)
  onRunRef.current = onRun
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange
  const onCursorPositionChangeRef = useRef(onCursorPositionChange)
  onCursorPositionChangeRef.current = onCursorPositionChange

  // editorValue is what we pass to <MonacoEditor value=…>.
  // We keep it in sync with the active model ourselves so that
  // @monaco-editor/react's own value-sync effect sees no delta and leaves our
  // model content alone (avoids overwriting unsaved edits on file switch).
  const [editorValue, setEditorValue] = useState(value)

  const options = useMemo<MonacoOptions>(
    () => ({ ...BASE_EDITOR_OPTIONS, fontFamily, fontLigatures, fontSize, bracketPairColorization: { enabled: bracketColorization } }),
    [fontFamily, fontLigatures, fontSize, bracketColorization],
  )

  function activateModel(
    editor: monacoEditor.editor.IStandaloneCodeEditor,
    monaco: Monaco,
    path: string,
    initialContent: string,
  ) {
    changeSubRef.current?.dispose()

    // Save view state (scroll + cursor) of the outgoing file before switching.
    const outgoingPath = activePathRef.current
    if (outgoingPath) {
      const vs = editor.saveViewState()
      if (vs) viewStatesRef.current.set(outgoingPath, vs)
    }

    const existing = modelsRef.current.get(path)
    const activeModel = existing ?? (() => {
      const uri = monaco.Uri.parse(`inmemory://model/${encodeURIComponent(path)}`)
      const m = monaco.editor.createModel(initialContent, 'python', uri)
      modelsRef.current.set(path, m)
      return m
    })()

    editor.setModel(activeModel)
    activePathRef.current = path

    // Restore saved view state (scroll + cursor) for this file, if any.
    const savedViewState = viewStatesRef.current.get(path)
    if (savedViewState) editor.restoreViewState(savedViewState)

    // Sync editorValue to the model's current content — this prevents
    // @monaco-editor/react from ever seeing a stale delta and pushing the
    // wrong content into the model.
    const current = activeModel.getValue()
    setEditorValue(current)
    onChangeRef.current(current)

    // Wire a per-model change listener so that editorValue stays in sync
    // and the parent receives every keystroke.
    changeSubRef.current = activeModel.onDidChangeContent(() => {
      const v = activeModel.getValue()
      setEditorValue(v)
      onChangeRef.current(v)
    })
  }

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor
      monacoRef.current = monaco

      editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
        () => onRunRef.current(),
      )

      editor.onDidChangeCursorSelection((e) => {
        const hasSelection = !e.selection.isEmpty()
        onSelectionChangeRef.current?.(hasSelection)
      })

      editor.onDidChangeCursorPosition((e) => {
        onCursorPositionChangeRef.current?.(e.position.lineNumber, e.position.column)
      })

      if (filePath) {
        activateModel(editor, monaco, filePath, value)
      }
    },
    // handleMount runs once on mount; filePath/value are captured via refs or
    // by the useEffect below for subsequent changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Activate (create or switch to) the model whenever filePath changes.
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    // Not mounted yet — handleMount handles the first activation.
    if (!editor || !monaco || !filePath) return
    activateModel(editor, monaco, filePath, value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath])

  useImperativeHandle(
    ref,
    () => ({
      disposeModel(path: string) {
        const model = modelsRef.current.get(path)
        if (model) {
          model.dispose()
          modelsRef.current.delete(path)
          viewStatesRef.current.delete(path)
        }
      },
      getSelectedText() {
        const editor = editorRef.current
        if (!editor) return null
        const selection = editor.getSelection()
        if (!selection) return null
        const text = editor.getModel()?.getValueInRange(selection) ?? ''
        return text || null
      },
      setModelValue(path: string, content: string) {
        const model = modelsRef.current.get(path)
        if (model) {
          model.setValue(content)
        }
      },
    }),
    [],
  )

  return (
    <div className={styles.container}>
      <MonacoEditor
        language="python"
        theme={monacoTheme}
        value={editorValue}
        // In multi-model mode we handle onChange via the model subscription
        // above; passing it here would cause double-firing.
        onChange={filePath ? undefined : (val) => onChange(val ?? '')}
        onMount={handleMount}
        options={options}
      />
    </div>
  )
})
