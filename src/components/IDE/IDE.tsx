import { useCallback, useState } from 'react'
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

  const handleRun = useCallback(() => {
    runCode(code)
  }, [code, runCode])

  // Global shortcut for when focus is outside Monaco
  useKeyboardShortcut({ key: 'Enter', metaOrCtrl: true }, handleRun)

  return (
    <div className={styles.ide}>
      <Toolbar
        status={status}
        onRun={handleRun}
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
