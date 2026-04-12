import { useEffect, useRef, useState } from 'react'
import { FileNode } from '../../types'
import styles from './FileTree.module.css'

// ── Types ──────────────────────────────────────────────────────────────────

type PendingAction =
  | { type: 'createFile'; parentPath: string }
  | { type: 'createFolder'; parentPath: string }
  | { type: 'rename'; path: string }
  | null

export interface FileOps {
  onCreateFile: (parentPath: string, name: string) => void
  onCreateFolder: (parentPath: string, name: string) => void
  onRename: (path: string, newName: string) => void
  onDelete: (path: string) => void
}

interface FileTreeProps {
  nodes: FileNode[]
  activeFilePath: string | null
  unsavedPath?: string | null
  onFileSelect: (path: string) => void
  onOpenFolder: () => void
  ops?: FileOps
}

interface TreeNodeProps {
  node: FileNode
  activeFilePath: string | null
  unsavedPath?: string | null
  onFileSelect: (path: string) => void
  ops?: FileOps
  pendingAction: PendingAction
  setPendingAction: (a: PendingAction) => void
  depth: number
}

// ── Icons ──────────────────────────────────────────────────────────────────

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"
      className={`${styles.chevronIcon} ${expanded ? styles.chevronExpanded : ''}`}
    >
      <path d="M2 1l4 3-4 3V1z" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor" aria-hidden="true">
      <path d="M0 2a1 1 0 0 1 1-1h4l1.5 2H13a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V2z" opacity="0.65" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="none" aria-hidden="true">
      <path d="M1 1.5h7l3 3V13a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 1 13V1.5z" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.55" />
      <path d="M7.5 1.5v3.5H11" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.55" />
    </svg>
  )
}

function NewFileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M1 1.5h6l3 3V12a.5.5 0 0 1-.5.5h-8.5A.5.5 0 0 1 1 12V1.5z" stroke="currentColor" strokeWidth="1.1" fill="none" opacity="0.7" />
      <path d="M6.5 1.5v3.5H9.5" stroke="currentColor" strokeWidth="1.1" fill="none" opacity="0.7" />
      <path d="M10 10.5h4M12 8.5v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function NewFolderIcon() {
  return (
    <svg width="15" height="13" viewBox="0 0 15 13" fill="currentColor" aria-hidden="true">
      <path d="M0 2.5a1 1 0 0 1 1-1h3.5l1.5 2H12a1 1 0 0 1 1 1v3H11v-2H1v5h7v2H1a1 1 0 0 1-1-1V2.5z" opacity="0.6" />
      <path d="M11.5 9.5h3M13 8v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function RenameIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  )
}

function DeleteIcon() {
  return (
    <svg width="12" height="13" viewBox="0 0 12 13" fill="none" aria-hidden="true">
      <path d="M1 3h10M4 3V1.5h4V3M2 3l.8 8.5h6.4L10 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Inline input ───────────────────────────────────────────────────────────

function InlineInput({
  defaultValue = '',
  onConfirm,
  onCancel,
}: {
  defaultValue?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    ref.current?.focus()
    if (defaultValue) ref.current?.select()
  }, [defaultValue])

  function commit() {
    if (value.trim()) onConfirm(value.trim())
    else onCancel()
  }

  return (
    <input
      ref={ref}
      className={styles.inlineInput}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') commit()
        else if (e.key === 'Escape') onCancel()
      }}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

// ── Tree node ──────────────────────────────────────────────────────────────

function TreeNode({ node, activeFilePath, unsavedPath, onFileSelect, ops, pendingAction, setPendingAction, depth }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0)
  const indent = depth * 12

  const isRenaming = pendingAction?.type === 'rename' && pendingAction.path === node.path
  const isCreatingInside =
    (pendingAction?.type === 'createFile' || pendingAction?.type === 'createFolder') &&
    pendingAction.parentPath === node.path

  // Auto-expand when an item is being created inside this directory
  useEffect(() => {
    if (isCreatingInside) setExpanded(true)
  }, [isCreatingInside])

  const sharedProps = { activeFilePath, unsavedPath, onFileSelect, ops, pendingAction, setPendingAction }

  if (node.type === 'directory') {
    return (
      <div>
        <div
          className={styles.dirRow}
          style={{ paddingLeft: `${8 + indent}px` }}
          onClick={() => !isRenaming && setExpanded((e) => !e)}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isRenaming) setExpanded((p) => !p)
          }}
        >
          <span className={styles.chevron}>
            <ChevronIcon expanded={expanded} />
          </span>
          <span className={styles.icon}>
            <FolderIcon />
          </span>
          {isRenaming ? (
            <InlineInput
              defaultValue={node.name}
              onConfirm={(name) => { ops!.onRename(node.path, name); setPendingAction(null) }}
              onCancel={() => setPendingAction(null)}
            />
          ) : (
            <span className={styles.name}>{node.name}</span>
          )}
          {ops && !isRenaming && (
            <span className={styles.actions} onClick={(e) => e.stopPropagation()}>
              <button
                className={styles.actionBtn} title="New file"
                onClick={() => { setExpanded(true); setPendingAction({ type: 'createFile', parentPath: node.path }) }}
              ><NewFileIcon /></button>
              <button
                className={styles.actionBtn} title="New folder"
                onClick={() => { setExpanded(true); setPendingAction({ type: 'createFolder', parentPath: node.path }) }}
              ><NewFolderIcon /></button>
              <button
                className={styles.actionBtn} title="Rename"
                onClick={() => setPendingAction({ type: 'rename', path: node.path })}
              ><RenameIcon /></button>
              <button
                className={styles.actionBtn} title="Delete"
                onClick={() => {
                  if (window.confirm(`Delete "${node.name}" and all its contents?`)) {
                    ops.onDelete(node.path)
                  }
                }}
              ><DeleteIcon /></button>
            </span>
          )}
        </div>

        {expanded && (
          <>
            {isCreatingInside && (
              <div
                className={styles.fileRow}
                style={{ paddingLeft: `${8 + (depth + 1) * 12 + 16}px` }}
              >
                <span className={styles.icon}>
                  {pendingAction!.type === 'createFile' ? <FileIcon /> : <FolderIcon />}
                </span>
                <InlineInput
                  onConfirm={(name) => {
                    pendingAction!.type === 'createFile'
                      ? ops!.onCreateFile(node.path, name)
                      : ops!.onCreateFolder(node.path, name)
                    setPendingAction(null)
                  }}
                  onCancel={() => setPendingAction(null)}
                />
              </div>
            )}
            {node.children?.map((child) => (
              <TreeNode key={child.path} node={child} {...sharedProps} depth={depth + 1} />
            ))}
          </>
        )}
      </div>
    )
  }

  // File node
  const isActive = activeFilePath === node.path
  const isUnsaved = unsavedPath === node.path

  return (
    <div
      className={`${styles.fileRow} ${isActive ? styles.activeFile : ''}`}
      style={{ paddingLeft: `${8 + indent + 16}px` }}
      onClick={() => !isRenaming && onFileSelect(node.path)}
      role="button"
      tabIndex={0}
      aria-current={isActive ? 'true' : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isRenaming) onFileSelect(node.path)
      }}
    >
      <span className={styles.icon}>
        <FileIcon />
      </span>
      {isRenaming ? (
        <InlineInput
          defaultValue={node.name}
          onConfirm={(name) => { ops!.onRename(node.path, name); setPendingAction(null) }}
          onCancel={() => setPendingAction(null)}
        />
      ) : (
        <span className={styles.name}>{node.name}</span>
      )}
      {isUnsaved && !isRenaming && (
        <span className={styles.unsavedDot} aria-label="Unsaved changes" title="Unsaved changes">●</span>
      )}
      {ops && !isRenaming && (
        <span className={styles.actions} onClick={(e) => e.stopPropagation()}>
          <button
            className={styles.actionBtn} title="Rename"
            onClick={() => setPendingAction({ type: 'rename', path: node.path })}
          ><RenameIcon /></button>
          <button
            className={styles.actionBtn} title="Delete"
            onClick={() => {
              if (window.confirm(`Delete "${node.name}"?`)) ops.onDelete(node.path)
            }}
          ><DeleteIcon /></button>
        </span>
      )}
    </div>
  )
}

// ── FileTree ───────────────────────────────────────────────────────────────

export function FileTree({ nodes, activeFilePath, unsavedPath, onFileSelect, onOpenFolder, ops }: FileTreeProps) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)

  // Header "+file"/"+folder" create at the directory of the active file,
  // falling back to the project root (first node's path).
  const rootPath = nodes[0]?.path ?? ''
  const defaultParent = activeFilePath
    ? activeFilePath.slice(0, activeFilePath.lastIndexOf('/'))
    : rootPath

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Explorer</span>
        {ops && nodes.length > 0 && (
          <span className={styles.headerActions}>
            <button
              className={styles.actionBtn} title="New file"
              onClick={() => setPendingAction({ type: 'createFile', parentPath: defaultParent })}
            ><NewFileIcon /></button>
            <button
              className={styles.actionBtn} title="New folder"
              onClick={() => setPendingAction({ type: 'createFolder', parentPath: defaultParent })}
            ><NewFolderIcon /></button>
          </span>
        )}
      </div>

      <div className={styles.tree} role="tree" aria-label="File explorer">
        {nodes.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>No folder opened</p>
            <button className={styles.openFolderBtn} onClick={onOpenFolder}>
              Open Folder
            </button>
          </div>
        ) : (
          nodes.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              activeFilePath={activeFilePath}
              unsavedPath={unsavedPath}
              onFileSelect={onFileSelect}
              ops={ops}
              pendingAction={pendingAction}
              setPendingAction={setPendingAction}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  )
}
