import { useCallback, useEffect, useRef, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Editor } from '../Editor/Editor'
import { FileTree } from '../FileTree/FileTree'
import { OutputPanel } from '../OutputPanel/OutputPanel'
import { Toolbar } from '../Toolbar/Toolbar'
import { usePyodide } from '../../hooks/usePyodide'
import { useFont } from '../../hooks/useFont'
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut'
import { fsaSupported, readDirectory, writeToDirectory } from '../../hooks/useFSA'
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

function sortFileNodes(nodes: FileNode[]): FileNode[] {
  return nodes
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .map((n) =>
      n.type === 'directory' && n.children ? { ...n, children: sortFileNodes(n.children) } : n,
    )
}

// Build a file tree from File[] (fallback path using <input webkitdirectory>).
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

  return sortFileNodes(root)
}

// Build a file tree from a flat list of paths (FSA path).
function buildFileTreeFromPaths(paths: string[]): FileNode[] {
  const root: FileNode[] = []

  for (const path of paths) {
    const parts = path.split('/')
    let nodes = root

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const nodePath = parts.slice(0, i + 1).join('/')
      const isLast = i === parts.length - 1

      if (isLast) {
        nodes.push({ name, path: nodePath, type: 'file' })
      } else {
        let dir = nodes.find((n) => n.name === name && n.type === 'directory')
        if (!dir) {
          dir = { name, path: nodePath, type: 'directory', children: [] }
          nodes.push(dir)
        }
        nodes = dir.children!
      }
    }
  }

  return sortFileNodes(root)
}

export function IDE() {
  const [code, setCode] = useState(DEFAULT_CODE)
  const { status, output, runCode, clearOutput, mountFiles } = usePyodide()
  const { font, setFont } = useFont()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Stores text content of every file in the current folder: path → content
  const contentMapRef = useRef<Map<string, string>>(new Map())
  // Holds the FSA directory handle when a folder was opened via showDirectoryPicker.
  // Null when using the fallback <input webkitdirectory> (no write-back possible).
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null)

  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  // The editor content at the time the active file was last loaded or saved.
  // Used to determine whether there are unsaved changes.
  const [lastSavedCode, setLastSavedCode] = useState<string | null>(null)

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

  const handleOpenFolderClick = useCallback(async () => {
    if (fsaSupported()) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
        dirHandleRef.current = handle

        const contents = await readDirectory(handle)
        contentMapRef.current = contents

        setFileTree(buildFileTreeFromPaths(Array.from(contents.keys())))
        setActiveFilePath(null)
        setLastSavedCode(null)

        const cwd = `/project/${handle.name}`
        mountFiles(contents, cwd)
      } catch (err) {
        // AbortError = user cancelled the picker — silently ignore
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to open folder:', err)
        }
      }
    } else {
      // Fallback for Firefox / Safari: read-only via <input webkitdirectory>
      folderInputRef.current?.click()
    }
  }, [mountFiles])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      file.text().then((text) => {
        setCode(text)

        // Write the single file into Pyodide's MEMFS so open() calls work
        const contents = new Map([[file.name, text]])
        mountFiles(contents, '/project')
      })

      e.target.value = ''
    },
    [mountFiles],
  )

  // Fallback folder handler used when FSA is not supported.
  const handleFolderChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (files.length === 0) return

      dirHandleRef.current = null
      setLastSavedCode(null)

      const visibleFiles = files.filter(
        (f) => !f.webkitRelativePath.split('/').some((p) => p.startsWith('.')),
      )

      // Use allSettled so a single unreadable file (locked, binary, special)
      // doesn't abort the entire import.
      const results = await Promise.allSettled(
        visibleFiles.map(async (f) => [f.webkitRelativePath, await f.text()] as const),
      )
      const entries = results
        .filter((r): r is PromiseFulfilledResult<readonly [string, string]> => r.status === 'fulfilled')
        .map((r) => r.value)

      const contentMap = new Map(entries)
      contentMapRef.current = contentMap

      setFileTree(buildFileTree(files))
      setActiveFilePath(null)

      const firstPath = visibleFiles[0]?.webkitRelativePath ?? ''
      const rootFolder = firstPath.split('/')[0]
      const cwd = rootFolder ? `/project/${rootFolder}` : '/project'

      mountFiles(contentMap, cwd)

      e.target.value = ''
    },
    [mountFiles],
  )

  const handleFileSelect = useCallback((path: string) => {
    const content = contentMapRef.current.get(path)
    if (content === undefined) return
    setCode(content)
    setActiveFilePath(path)
    setLastSavedCode(content)
  }, [])

  const handleSave = useCallback(async () => {
    const handle = dirHandleRef.current
    if (!handle || !activeFilePath) return

    // Strip the directory name prefix to get the path relative to the handle.
    // e.g. "myproject/src/main.py" with handle.name="myproject" → "src/main.py"
    const relPath = activeFilePath.slice(handle.name.length + 1)
    try {
      await writeToDirectory(handle, relPath, code)
      contentMapRef.current.set(activeFilePath, code)
      setLastSavedCode(code)
    } catch (err) {
      console.error('Failed to save file:', err)
    }
  }, [activeFilePath, code])

  // A file has unsaved changes when the editor content differs from what was last loaded/saved.
  const canSave =
    dirHandleRef.current !== null &&
    activeFilePath !== null &&
    lastSavedCode !== null &&
    code !== lastSavedCode

  useKeyboardShortcut({ key: 'Enter', metaOrCtrl: true }, handleRun)
  useKeyboardShortcut({ key: 's', metaOrCtrl: true }, handleSave)

  // Only pass onSave when a folder was opened via FSA (write-back is available).
  const onSave = dirHandleRef.current !== null ? handleSave : undefined

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
        onSave={onSave}
        canSave={canSave}
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
