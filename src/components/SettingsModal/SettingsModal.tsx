import { useEffect, useRef } from 'react'
import type { Theme } from '../../hooks/useTheme'
import styles from './SettingsModal.module.css'

interface SettingsModalProps {
  onClose: () => void
  theme: Theme
  onThemeToggle: () => void
  autosaveEnabled?: boolean
  onAutosaveToggle?: () => void
  bracketColorization: boolean
  onBracketColorizationToggle: () => void
}

function SettingRow({ label, description, checked, onChange }: {
  label: string
  description: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        <span className={styles.rowDescription}>{description}</span>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={`${label} ${checked ? 'on, click to disable' : 'off, click to enable'}`}
        className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
        onClick={onChange}
      >
        <span className={styles.toggleThumb} />
      </button>
    </div>
  )
}

export function SettingsModal({
  onClose, theme, onThemeToggle, autosaveEnabled, onAutosaveToggle,
  bracketColorization, onBracketColorizationToggle,
}: SettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={onClose}
      onClick={(e) => { if (e.target === dialogRef.current) onClose() }}
    >
      <div className={styles.content}>
        <h2 className={styles.title}>Settings</h2>
        <div className={styles.rows}>
          <SettingRow
            label="Light mode"
            description="Switch to a light colour theme"
            checked={theme === 'light'}
            onChange={onThemeToggle}
          />
          {onAutosaveToggle && (
            <SettingRow
              label="Autosave"
              description="Save changes automatically every 5 seconds"
              checked={!!autosaveEnabled}
              onChange={onAutosaveToggle}
            />
          )}
          <SettingRow
            label="Bracket colors"
            description="Colorize matching brackets in the editor"
            checked={bracketColorization}
            onChange={onBracketColorizationToggle}
          />
        </div>
      </div>
    </dialog>
  )
}
