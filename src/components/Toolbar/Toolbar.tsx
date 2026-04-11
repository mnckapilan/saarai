import { PyodideStatus } from '../../types'
import { type FontOption, MONO_FONTS } from '../../constants/fonts'
import styles from './Toolbar.module.css'

interface ToolbarProps {
  status: PyodideStatus
  onRun: () => void
  onImport: () => void
  onOpenFolder: () => void
  /** Present only when a folder was opened via the File System Access API. */
  onSave?: () => void
  /** Whether there are unsaved changes to the active file. */
  canSave?: boolean
  /** Re-reads all files from disk; present only when opened via FSA. */
  onReload?: () => void
  font: FontOption
  onFontChange: (font: FontOption) => void
}

function PlayIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 11 11"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2 1.5l8 4-8 4V1.5z" />
    </svg>
  )
}

function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />
}

export function Toolbar({ status, onRun, onImport, onOpenFolder, onSave, canSave, onReload, font, onFontChange }: ToolbarProps) {
  const isLoading = status === 'loading'
  const isRunning = status === 'running'
  const isError = status === 'error'
  const disabled = isLoading || isRunning || isError

  function handleFontChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const selected = MONO_FONTS.find((f) => f.value === e.target.value)
    if (selected) onFontChange(selected)
  }

  return (
    <header className={styles.toolbar} role="banner">
      <div className={styles.left}>
        <span className={styles.logo} aria-label="Python">
          🐍
        </span>
        <span className={styles.title}>Python IDE</span>
        <button
          className={styles.importButton}
          onClick={onImport}
          title="Open .py file"
          aria-label="Import Python file"
        >
          Open file
        </button>
        <button
          className={styles.importButton}
          onClick={onOpenFolder}
          title="Open folder"
          aria-label="Open folder"
        >
          Open folder
        </button>
        {onSave && (
          <button
            className={styles.saveButton}
            onClick={onSave}
            disabled={!canSave}
            title="Save file (⌘S / Ctrl+S)"
            aria-label="Save file"
          >
            {canSave ? '● Save' : 'Save'}
          </button>
        )}
        {onReload && (
          <button
            className={styles.importButton}
            onClick={onReload}
            title="Reload all files from disk"
            aria-label="Reload from disk"
          >
            Reload
          </button>
        )}
      </div>

      <div className={styles.right}>
        <label className={styles.fontLabel} htmlFor="font-select">
          Font
        </label>
        <select
          id="font-select"
          className={styles.fontSelect}
          value={font.value}
          onChange={handleFontChange}
          style={{ fontFamily: font.value }}
          aria-label="Editor font"
        >
          {MONO_FONTS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <div className={styles.divider} aria-hidden="true" />
        <div className={styles.status} aria-live="polite">
          {isLoading && (
            <span className={styles.statusLoading}>
              <Spinner />
              Loading runtime…
            </span>
          )}
          {isRunning && (
            <span className={styles.statusRunning}>Running…</span>
          )}
          {status === 'ready' && (
            <span className={styles.statusReady}>● Ready</span>
          )}
          {isError && (
            <span className={styles.statusError}>● Runtime error</span>
          )}
        </div>

        <button
          className={styles.runButton}
          onClick={onRun}
          disabled={disabled}
          title="Run code (⌘↵ / Ctrl+↵)"
          aria-label="Run code"
        >
          <PlayIcon />
          Run
        </button>
      </div>
    </header>
  )
}
