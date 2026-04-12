import { useCallback, useEffect, useRef, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { Editor, type EditorHandle } from '../Editor/Editor'
import { FileTree } from '../FileTree/FileTree'
import { OutputPanel } from '../OutputPanel/OutputPanel'
import { Toolbar } from '../Toolbar/Toolbar'
import { WelcomeModal } from '../WelcomeModal/WelcomeModal'
import { usePyodide } from '../../hooks/usePyodide'
import { useFont } from '../../hooks/useFont'
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut'
import {
  fsaSupported,
  readDirectory,
  writeToDirectory,
  deleteFromDirectory,
  createDirectoryInDirectory,
} from '../../hooks/useFSA'
import { FileNode } from '../../types'
import styles from './IDE.module.css'

const WELCOME_SEEN_KEY = 'saarai:welcomeSeen'


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

// Build a file tree from File[] (fallback path via <input webkitdirectory>).
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

// Build a file tree from flat path lists. extraDirPaths ensures empty
// directories created by the user appear in the tree even without files.
function buildFileTreeFromPaths(filePaths: string[], extraDirPaths: string[] = []): FileNode[] {
  const root: FileNode[] = []

  function ensureDir(path: string) {
    const parts = path.split('/')
    let nodes = root
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const nodePath = parts.slice(0, i + 1).join('/')
      let dir = nodes.find((n) => n.name === name && n.type === 'directory')
      if (!dir) {
        dir = { name, path: nodePath, type: 'directory', children: [] }
        nodes.push(dir)
      }
      nodes = dir.children!
    }
  }

  for (const dirPath of extraDirPaths) ensureDir(dirPath)

  for (const path of filePaths) {
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
  const [code, setCode] = useState('')
  const { status, output, runCode, clearOutput, mountFiles, patchFile } = usePyodide()
  const { font, setFont } = useFont()
  const [showWelcome, setShowWelcome] = useState(
    () => !sessionStorage.getItem(WELCOME_SEEN_KEY),
  )

  function handleCloseWelcome() {
    sessionStorage.setItem(WELCOME_SEEN_KEY, '1')
    setShowWelcome(false)
  }

  const editorRef = useRef<EditorHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // path → text content for all files in the current project
  const contentMapRef = useRef<Map<string, string>>(new Map())
  // explicitly created empty directories (not derivable from contentMapRef)
  const emptyDirsRef = useRef<Set<string>>(new Set())
  // FSA handle — present only when opened via showDirectoryPicker
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null)
  // current Python working directory inside MEMFS
  const cwdRef = useRef<string>('/project')

  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null)
  const [lastSavedCode, setLastSavedCode] = useState<string | null>(null)
  const [autosaveEnabled, setAutosaveEnabled] = useState(false)
  // 'auto' → last save was triggered by autosave; 'manual' → user-initiated; null → no save yet / file just loaded
  const [lastSaveType, setLastSaveType] = useState<'auto' | 'manual' | null>(null)

  // Stable refs so the autosave interval never captures stale closures.
  const canSaveRef = useRef(false)
  const handleSaveRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false))

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '')
  }, [])

  function refreshFileTree() {
    setFileTree(
      buildFileTreeFromPaths(
        Array.from(contentMapRef.current.keys()),
        Array.from(emptyDirsRef.current),
      ),
    )
  }

  const handleRun = useCallback(() => {
    // Pass the MEMFS directory of the active file so runCode can add it to
    // sys.path[0], mirroring `python script.py` behaviour. Without this,
    // imports of sibling modules fail when the active file is in a subdirectory.
    const scriptDir = activeFilePath
      ? `/project/${activeFilePath.slice(0, activeFilePath.lastIndexOf('/'))}`
      : undefined
    runCode(code, scriptDir)
  }, [code, runCode, activeFilePath])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleOpenFolderClick = useCallback(async () => {
    if (fsaSupported()) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
        dirHandleRef.current = handle
        emptyDirsRef.current = new Set()

        const contents = await readDirectory(handle)
        contentMapRef.current = contents

        const cwd = `/project/${handle.name}`
        cwdRef.current = cwd

        setFileTree(buildFileTreeFromPaths(Array.from(contents.keys())))
        setActiveFilePath(null)
        setLastSavedCode(null)
        setLastSaveType(null)
        mountFiles(contents, cwd)
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Failed to open folder:', err)
        }
      }
    } else {
      folderInputRef.current?.click()
    }
  }, [mountFiles])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      file.text().then((text) => {
        contentMapRef.current = new Map([[file.name, text]])
        refreshFileTree()
        setCode(text)
        setActiveFilePath(file.name)
        setLastSavedCode(text)
        setLastSaveType(null)
        mountFiles(contentMapRef.current, '/project')
      })
      e.target.value = ''
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mountFiles],
  )

  const handleFolderChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (files.length === 0) return

      dirHandleRef.current = null
      emptyDirsRef.current = new Set()
      setLastSavedCode(null)
      setLastSaveType(null)

      const visibleFiles = files.filter(
        (f) => !f.webkitRelativePath.split('/').some((p) => p.startsWith('.')),
      )

      const results = await Promise.allSettled(
        visibleFiles.map(async (f) => [f.webkitRelativePath, await f.text()] as const),
      )
      const entries = results
        .filter((r): r is PromiseFulfilledResult<readonly [string, string]> => r.status === 'fulfilled')
        .map((r) => r.value)

      const contentMap = new Map(entries)
      contentMapRef.current = contentMap

      const firstPath = visibleFiles[0]?.webkitRelativePath ?? ''
      const rootFolder = firstPath.split('/')[0]
      const cwd = rootFolder ? `/project/${rootFolder}` : '/project'
      cwdRef.current = cwd

      setFileTree(buildFileTree(files))
      setActiveFilePath(null)
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
    setLastSaveType(null)
  }, [])

  const handleSave = useCallback(async (): Promise<boolean> => {
    const handle = dirHandleRef.current
    if (!handle || !activeFilePath) return false
    const relPath = activeFilePath.slice(handle.name.length + 1)
    try {
      await writeToDirectory(handle, relPath, code)
      contentMapRef.current.set(activeFilePath, code)
      setLastSavedCode(code)
      // Keep MEMFS in sync so the next run sees the saved content.
      patchFile(`/project/${activeFilePath}`, code)
      return true
    } catch (err) {
      console.error('Failed to save file:', err)
      return false
    }
  }, [activeFilePath, code, patchFile])

  const handleManualSave = useCallback(async () => {
    if (await handleSave()) setLastSaveType('manual')
  }, [handleSave])

  const handleReload = useCallback(async () => {
    const handle = dirHandleRef.current
    if (!handle) return

    const confirmed = window.confirm(
      `Reload "${handle.name}" from disk?\n\n` +
      `All files will be re-read from their current state on disk. ` +
      `Any unsaved edits in the editor will be lost.`,
    )
    if (!confirmed) return

    try {
      const contents = await readDirectory(handle)
      contentMapRef.current = contents
      // Empty dirs aren't recoverable from a disk read — clear them.
      emptyDirsRef.current = new Set()

      refreshFileTree()
      mountFiles(contents, cwdRef.current)

      setLastSaveType(null)

      // Reload the active file's content if it still exists; deselect if gone.
      if (activeFilePath) {
        const fresh = contents.get(activeFilePath)
        if (fresh !== undefined) {
          setCode(fresh)
          setLastSavedCode(fresh)
        } else {
          setActiveFilePath(null)
          setLastSavedCode(null)
          setCode('')
        }
      }
    } catch (err) {
      console.error('Failed to reload folder:', err)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilePath, mountFiles])

  // ── File operations ────────────────────────────────────────────────────────

  const handleCreateFile = useCallback(
    async (parentPath: string, name: string) => {
      const filePath = `${parentPath}/${name}`
      if (contentMapRef.current.has(filePath)) return // already exists
      contentMapRef.current.set(filePath, '')
      emptyDirsRef.current.delete(parentPath) // no longer empty
      refreshFileTree()
      mountFiles(contentMapRef.current, cwdRef.current)
      if (dirHandleRef.current) {
        const relPath = filePath.slice(dirHandleRef.current.name.length + 1)
        await writeToDirectory(dirHandleRef.current, relPath, '').catch(console.error)
      }
      // Select the new file for immediate editing
      setCode('')
      setActiveFilePath(filePath)
      setLastSavedCode('')
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mountFiles],
  )

  const handleCreateFolder = useCallback(
    async (parentPath: string, name: string) => {
      const dirPath = `${parentPath}/${name}`
      emptyDirsRef.current.add(dirPath)
      refreshFileTree()
      if (dirHandleRef.current) {
        const relPath = dirPath.slice(dirHandleRef.current.name.length + 1)
        await createDirectoryInDirectory(dirHandleRef.current, relPath).catch(console.error)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const handleRename = useCallback(
    async (path: string, newName: string) => {
      const isFile = contentMapRef.current.has(path)
      const parent = path.slice(0, path.lastIndexOf('/'))
      const newPath = `${parent}/${newName}`

      if (isFile) {
        editorRef.current?.disposeModel(path)
        const content = contentMapRef.current.get(path)!
        contentMapRef.current.delete(path)
        contentMapRef.current.set(newPath, content)
        if (activeFilePath === path) {
          setActiveFilePath(newPath)
          setLastSavedCode(content)
        }
        if (dirHandleRef.current) {
          const h = dirHandleRef.current
          const oldRel = path.slice(h.name.length + 1)
          const newRel = newPath.slice(h.name.length + 1)
          await writeToDirectory(h, newRel, content).catch(console.error)
          await deleteFromDirectory(h, oldRel).catch(console.error)
        }
      } else {
        // Directory: remap all files and sub-dirs
        const snapshot = Array.from(contentMapRef.current.entries())
        for (const [filePath, content] of snapshot) {
          if (filePath.startsWith(path + '/')) {
            editorRef.current?.disposeModel(filePath)
            contentMapRef.current.delete(filePath)
            contentMapRef.current.set(newPath + filePath.slice(path.length), content)
          }
        }
        for (const dirPath of Array.from(emptyDirsRef.current)) {
          if (dirPath === path || dirPath.startsWith(path + '/')) {
            emptyDirsRef.current.delete(dirPath)
            emptyDirsRef.current.add(newPath + dirPath.slice(path.length))
          }
        }
        if (activeFilePath?.startsWith(path + '/')) {
          setActiveFilePath(newPath + activeFilePath.slice(path.length))
        }
        if (dirHandleRef.current) {
          const h = dirHandleRef.current
          // Write all files at new paths first, then remove old dir
          for (const [filePath, content] of contentMapRef.current) {
            if (filePath.startsWith(newPath + '/')) {
              await writeToDirectory(h, filePath.slice(h.name.length + 1), content).catch(console.error)
            }
          }
          await deleteFromDirectory(h, path.slice(h.name.length + 1)).catch(console.error)
        }
        // Update cwdRef if it was inside the renamed dir
        if (cwdRef.current.startsWith(`/project/${path}`)) {
          cwdRef.current = `/project/${newPath}${cwdRef.current.slice(`/project/${path}`.length)}`
        }
      }

      refreshFileTree()
      mountFiles(contentMapRef.current, cwdRef.current)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeFilePath, mountFiles],
  )

  const handleDelete = useCallback(
    async (path: string) => {
      const isFile = contentMapRef.current.has(path)

      if (isFile) {
        editorRef.current?.disposeModel(path)
        contentMapRef.current.delete(path)
        if (activeFilePath === path) {
          setActiveFilePath(null)
          setLastSavedCode(null)
          setCode('')
        }
      } else {
        for (const filePath of Array.from(contentMapRef.current.keys())) {
          if (filePath.startsWith(path + '/')) {
            editorRef.current?.disposeModel(filePath)
            contentMapRef.current.delete(filePath)
          }
        }
        for (const dirPath of Array.from(emptyDirsRef.current)) {
          if (dirPath === path || dirPath.startsWith(path + '/')) {
            emptyDirsRef.current.delete(dirPath)
          }
        }
        if (activeFilePath === path || activeFilePath?.startsWith(path + '/')) {
          setActiveFilePath(null)
          setLastSavedCode(null)
          setCode('')
        }
      }

      refreshFileTree()
      mountFiles(contentMapRef.current, cwdRef.current)
      if (dirHandleRef.current) {
        const relPath = path.slice(dirHandleRef.current.name.length + 1)
        await deleteFromDirectory(dirHandleRef.current, relPath).catch(console.error)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeFilePath, mountFiles],
  )

  // ── Derived state ──────────────────────────────────────────────────────────

  const canSave =
    dirHandleRef.current !== null &&
    activeFilePath !== null &&
    lastSavedCode !== null &&
    code !== lastSavedCode

  // Keep refs current so the autosave interval closure never goes stale.
  canSaveRef.current = canSave
  handleSaveRef.current = handleSave

  useEffect(() => {
    if (!autosaveEnabled) return
    const id = setInterval(async () => {
      if (canSaveRef.current) {
        const saved = await handleSaveRef.current()
        if (saved) setLastSaveType('auto')
      }
    }, 5_000)
    return () => clearInterval(id)
  }, [autosaveEnabled])

  const saveStatus: 'unsaved' | 'autosaved' | null = canSave
    ? 'unsaved'
    : lastSaveType === 'auto'
    ? 'autosaved'
    : null

  const fsaOpen = dirHandleRef.current !== null
  const onSave = fsaOpen ? handleManualSave : undefined
  const onReload = fsaOpen ? handleReload : undefined
  const onAutosaveToggle = fsaOpen ? () => setAutosaveEnabled((v) => !v) : undefined

  const fileOps =
    fileTree.length > 0
      ? {
          onCreateFile: handleCreateFile,
          onCreateFolder: handleCreateFolder,
          onRename: handleRename,
          onDelete: handleDelete,
        }
      : undefined

  useKeyboardShortcut({ key: 'Enter', metaOrCtrl: true }, handleRun)
  useKeyboardShortcut({ key: 's', metaOrCtrl: true }, handleManualSave)

  return (
    <div className={styles.ide}>
      {showWelcome && <WelcomeModal onClose={handleCloseWelcome} />}
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
        onReload={onReload}
        autosaveEnabled={autosaveEnabled}
        onAutosaveToggle={onAutosaveToggle}
        saveStatus={saveStatus}
        font={font}
        onFontChange={setFont}
        onAbout={() => setShowWelcome(true)}
      />

      <PanelGroup direction="horizontal" className={styles.panelGroup}>
        <Panel defaultSize={20} minSize={12} maxSize={45} className={styles.panel}>
          <FileTree
            nodes={fileTree}
            activeFilePath={activeFilePath}
            onFileSelect={handleFileSelect}
            onOpenFolder={handleOpenFolderClick}
            ops={fileOps}
          />
        </Panel>

        <PanelResizeHandle className={styles.resizeHandleCol}>
          <div className={styles.resizeHandleBarCol} />
        </PanelResizeHandle>

        <Panel className={styles.panel}>
          <PanelGroup direction="vertical">
            <Panel defaultSize={65} minSize={20} className={styles.panel}>
              {activeFilePath !== null ? (
                <Editor
                  ref={editorRef}
                  value={code}
                  filePath={activeFilePath}
                  onChange={setCode}
                  onRun={handleRun}
                  fontFamily={font.value}
                  fontLigatures={font.ligatures}
                />
              ) : (
                <div className={styles.noFile}>
                  <span className={styles.noFileTitle}>No file open</span>
                  <div className={styles.noFileButtons}>
                    <button className={styles.noFileButton} onClick={handleImportClick}>
                      Open file
                    </button>
                    <button className={styles.noFileButton} onClick={handleOpenFolderClick}>
                      Open folder
                    </button>
                  </div>
                </div>
              )}
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
