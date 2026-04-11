import { useState } from 'react'
import { FileNode } from '../../types'
import styles from './FileTree.module.css'

interface FileTreeProps {
  nodes: FileNode[]
  activeFilePath: string | null
  onFileSelect: (path: string) => void
  onOpenFolder: () => void
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      fill="currentColor"
      aria-hidden="true"
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
      <path
        d="M1 1.5h7l3 3V13a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 1 13V1.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.55"
      />
      <path d="M7.5 1.5v3.5H11" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.55" />
    </svg>
  )
}

function TreeNode({
  node,
  activeFilePath,
  onFileSelect,
  depth,
}: {
  node: FileNode
  activeFilePath: string | null
  onFileSelect: (path: string) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const indent = depth * 12

  if (node.type === 'directory') {
    return (
      <div>
        <div
          className={styles.dirRow}
          style={{ paddingLeft: `${8 + indent}px` }}
          onClick={() => setExpanded((e) => !e)}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setExpanded((prev) => !prev)
          }}
        >
          <span className={styles.chevron}>
            <ChevronIcon expanded={expanded} />
          </span>
          <span className={styles.icon}>
            <FolderIcon />
          </span>
          <span className={styles.name}>{node.name}</span>
        </div>
        {expanded &&
          node.children?.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              activeFilePath={activeFilePath}
              onFileSelect={onFileSelect}
              depth={depth + 1}
            />
          ))}
      </div>
    )
  }

  const isActive = activeFilePath === node.path

  return (
    <div
      className={`${styles.fileRow} ${isActive ? styles.activeFile : ''}`}
      style={{ paddingLeft: `${8 + indent + 16}px` }}
      onClick={() => onFileSelect(node.path)}
      role="button"
      tabIndex={0}
      aria-current={isActive ? 'true' : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onFileSelect(node.path)
      }}
    >
      <span className={styles.icon}>
        <FileIcon />
      </span>
      <span className={styles.name}>{node.name}</span>
    </div>
  )
}

export function FileTree({ nodes, activeFilePath, onFileSelect, onOpenFolder }: FileTreeProps) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Explorer</span>
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
              onFileSelect={onFileSelect}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  )
}
