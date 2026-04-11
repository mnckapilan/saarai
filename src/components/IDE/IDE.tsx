import { useCallback, useRef, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Editor } from '../Editor/Editor'
import { OutputPanel } from '../OutputPanel/OutputPanel'
import { Toolbar } from '../Toolbar/Toolbar'
import { usePyodide } from '../../hooks/usePyodide'
import { useFont } from '../../hooks/useFont'
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut'
import styles from './IDE.module.css'

const DEFAULT_CODE = `# Welcome to Python Web IDE
# Press ▶ Run or Cmd+Enter / Ctrl+Enter to execute

def greet(name: str) -> str:
    return f"Hello, {name}!"

names = ["World", "Python", "Browser"]
for name in names:
    print(greet(name))

# Try some math
import math
print(f"\\nπ ≈ {math.pi:.6f}")
print(f"√2 ≈ {math.sqrt(2):.6f}")
`

export function IDE() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const { status, output, runCode, clearOutput } = usePyodide()
  const { font, setFont } = useFont()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleRun = useCallback(() => {
    runCode(code)
  }, [code, runCode])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result
      if (typeof text === 'string') setCode(text)
    }
    reader.readAsText(file)
    // Reset so the same file can be re-imported
    e.target.value = ''
  }, [])

  // Global shortcut for when focus is outside Monaco
  useKeyboardShortcut({ key: 'Enter', metaOrCtrl: true }, handleRun)

  return (
    <div className={styles.ide}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".py,.txt"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
      />
      <Toolbar
        status={status}
        onRun={handleRun}
        onImport={handleImportClick}
        font={font}
        onFontChange={setFont}
      />

      <PanelGroup direction="vertical" className={styles.panelGroup}>
        <Panel defaultSize={65} minSize={20} className={styles.panel}>
          <Editor
            value={code}
            onChange={setCode}
            onRun={handleRun}
            fontFamily={font.value}
            fontLigatures={font.ligatures}
          />
        </Panel>

        <PanelResizeHandle className={styles.resizeHandle}>
          <div className={styles.resizeHandleBar} />
        </PanelResizeHandle>

        <Panel defaultSize={35} minSize={12} className={styles.panel}>
          <OutputPanel output={output} onClear={clearOutput} />
        </Panel>
      </PanelGroup>
    </div>
  )
}
