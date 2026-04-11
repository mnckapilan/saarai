import { useCallback, useEffect, useRef, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Editor } from '../Editor/Editor'
import { FileTree } from '../FileTree/FileTree'
import { OutputPanel } from '../OutputPanel/OutputPanel'
import { Toolbar } from '../Toolbar/Toolbar'
import { usePyodide } from '../../hooks/usePyodide'
import { useFont } from '../../hooks/useFont'
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut'
import { FileNode } from '../../types'
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

function buildFileTree(files: File[]): FileNode[] {
  const root: FileNode[] = []

  for (const file of files) {
    const parts = file.webkitRelativePath.split('/')
    if (parts.some((p) => p.startsWith('.'))) continue
    let nodes = root

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const path = parts.slice(0, i + 1).join('/')
      const isLast = i === parts.length - 1

      if (isLast) {
        nodes.push({ name, path, type: 'file' })
      } else {
        let dir = nodes.find((n) => n.name === name && n.type === 'directory')
        if (!dir) {
          dir = { name, path, type: 'directory', children: [] }
          nodes.push(dir)
        }
        nodes = dir.children!
      }
    }
  }

  const sortNodes = (ns: FileNode[]): FileNode[] =>
    ns
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      .map((n) =>
        n.type === 'directory' && n.children ? { ...n, children: sortNodes(n.children) } : n,
      )

  return sortNodes(root)
}

export function IDE() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const { status, output, runCode, clearOutput } = usePyodide()
  const { font, setFont } = useFont()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const fileMapRef = useRef<Map<string, File>>(new Map())

  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)

  // webkitdirectory isn't in React's type defs — set via DOM after mount
  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '')
  }, [])

  const handleRun = useCallback(() => {
    runCode(code)
  }, [code, runCode])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleOpenFolderClick = useCallback(() => {
    folderInputRef.current?.click()
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
    e.target.value = ''
  }, [])

  const handleFolderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const map = fileMapRef.current
    map.clear()
    files.forEach((f) => map.set(f.webkitRelativePath, f))

    setFileTree(buildFileTree(files))
    setActiveFilePath(null)
    e.target.value = ''
  }, [])

  const handleFileSelect = useCallback((path: string) => {
    const file = fileMapRef.current.get(path)
    if (!file) return
    file.text().then((text) => {
      setCode(text)
      setActiveFilePath(path)
    })
  }, [])

  useKeyboardShortcut({ key: 'Enter', metaOrCtrl: true }, handleRun)

  return (
    <div className={styles.ide}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".py,.txt"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
      />
      <input
        ref={folderInputRef}
        type="file"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        onChange={handleFolderChange}
        aria-hidden="true"
      />

      <Toolbar
        status={status}
        onRun={handleRun}
        onImport={handleImportClick}
        onOpenFolder={handleOpenFolderClick}
        font={font}
        onFontChange={setFont}
      />

      <PanelGroup direction="horizontal" className={styles.panelGroup}>
        <Panel defaultSize={20} minSize={12} maxSize={45} className={styles.panel}>
          <FileTree
            nodes={fileTree}
            activeFilePath={activeFilePath}
            onFileSelect={handleFileSelect}
            onOpenFolder={handleOpenFolderClick}
          />
        </Panel>

        <PanelResizeHandle className={styles.resizeHandleCol}>
          <div className={styles.resizeHandleBarCol} />
        </PanelResizeHandle>

        <Panel className={styles.panel}>
          <PanelGroup direction="vertical">
            <Panel defaultSize={65} minSize={20} className={styles.panel}>
              <Editor
                value={code}
                onChange={setCode}
                onRun={handleRun}
                fontFamily={font.value}
                fontLigatures={font.ligatures}
              />
            </Panel>

            <PanelResizeHandle className={styles.resizeHandleRow}>
              <div className={styles.resizeHandleBarRow} />
            </PanelResizeHandle>

            <Panel defaultSize={35} minSize={12} className={styles.panel}>
              <OutputPanel output={output} onClear={clearOutput} />
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    </div>
  )
}
