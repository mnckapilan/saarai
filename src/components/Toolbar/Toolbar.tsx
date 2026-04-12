import { useEffect, useRef, useState } from 'react'
import { PyodideStatus } from '../../types'
import { type FontOption, MONO_FONTS } from '../../constants/fonts'
import type { Theme } from '../../hooks/useTheme'
import styles from './Toolbar.module.css'

interface ToolbarProps {
  status: PyodideStatus
  onRun: () => void
  /** Whether a file is currently open in the editor. */
  fileOpen?: boolean
  /** Whether the editor currently has a non-empty text selection. */
  hasEditorSelection?: boolean
  onImport: () => void
  onOpenFolder: () => void
  /** Present only when a folder was opened via the File System Access API. */
  onSave?: () => void
  /** Whether there are unsaved changes to the active file. */
  canSave?: boolean
  /** Re-reads all files from disk; present only when opened via FSA. */
  onReload?: () => void
  /** Whether autosave is currently enabled. */
  autosaveEnabled?: boolean
  /** Toggles autosave; present only when opened via FSA. */
  onAutosaveToggle?: () => void
  /** Save status to display alongside the autosave toggle. */
  saveStatus?: 'unsaved' | 'autosaved' | null
  font: FontOption
  onFontChange: (font: FontOption) => void
  fontSize: number
  onFontSizeChange: (size: number) => void
  theme: Theme
  onThemeToggle: () => void
  bracketColorization: boolean
  onBracketColorizationToggle: () => void
  onAbout: () => void
}

function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="6.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 6.5v4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7.5" cy="4.5" r="0.85" fill="currentColor" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="2.8" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path d="M11 8.5A5.5 5.5 0 0 1 4.5 2a5.5 5.5 0 1 0 6.5 6.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="currentColor" aria-hidden="true">
      <path d="M2 1.5l8 4-8 4V1.5z" />
    </svg>
  )
}

function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />
}

function ChevronIcon() {
  return (
    <svg width="8" height="5" viewBox="0 0 8 5" fill="none" aria-hidden="true">
      <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return { open, setOpen, ref }
}

function FileMenu({ onImport, onOpenFolder }: { onImport: () => void; onOpenFolder: () => void }) {
  const { open, setOpen, ref } = useDropdown()

  return (
    <div ref={ref} className={styles.menuRoot}>
      <button
        className={`${styles.menuTrigger} ${open ? styles.menuTriggerOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        File
        <ChevronIcon />
      </button>
      {open && (
        <div className={styles.menuPopup} role="menu">
          <button
            className={styles.menuItem}
            role="menuitem"
            onClick={() => { onImport(); setOpen(false) }}
          >
            Open file…
          </button>
          <button
            className={styles.menuItem}
            role="menuitem"
            onClick={() => { onOpenFolder(); setOpen(false) }}
          >
            Open folder…
          </button>
        </div>
      )}
    </div>
  )
}

function FontMenu({ font, onFontChange }: { font: FontOption; onFontChange: (f: FontOption) => void }) {
  const { open, setOpen, ref } = useDropdown()

  return (
    <div ref={ref} className={styles.menuRoot}>
      <button
        className={`${styles.menuTrigger} ${open ? styles.menuTriggerOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Editor font"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Aa
        <ChevronIcon />
      </button>
      {open && (
        <div className={`${styles.menuPopup} ${styles.menuPopupRight}`} role="menu">
          {MONO_FONTS.map((f) => (
            <button
              key={f.value}
              className={`${styles.menuItem} ${f.value === font.value ? styles.menuItemActive : ''}`}
              role="menuitem"
              style={{ fontFamily: f.value }}
              onClick={() => { onFontChange(f); setOpen(false) }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SettingsIcon() {
  return (
    <svg width="14" height="13" viewBox="0 0 14 13" fill="none" aria-hidden="true">
      <path d="M1 2h7.5M11.5 2H13M1 6.5H2M5 6.5h8M1 11h5M8 11h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="10" cy="2" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="3.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="6.5" cy="11" r="1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

function SettingRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className={styles.settingRow}>
      <span className={styles.settingLabel}>{label}</span>
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

function SettingsMenu({
  theme, onThemeToggle, autosaveEnabled, onAutosaveToggle, bracketColorization, onBracketColorizationToggle,
}: {
  theme: Theme
  onThemeToggle: () => void
  autosaveEnabled?: boolean
  onAutosaveToggle?: () => void
  bracketColorization: boolean
  onBracketColorizationToggle: () => void
}) {
  const { open, setOpen, ref } = useDropdown()

  return (
    <div ref={ref} className={styles.menuRoot}>
      <button
        className={`${styles.themeButton} ${open ? styles.themeButtonOpen : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Settings"
        aria-label="Settings"
        aria-expanded={open}
      >
        <SettingsIcon />
      </button>
      {open && (
        <div className={`${styles.settingsPopup} ${styles.menuPopupRight}`}>
          <SettingRow label="Light mode" checked={theme === 'light'} onChange={onThemeToggle} />
          {onAutosaveToggle && (
            <SettingRow label="Autosave" checked={!!autosaveEnabled} onChange={onAutosaveToggle} />
          )}
          <SettingRow label="Bracket colors" checked={bracketColorization} onChange={onBracketColorizationToggle} />
        </div>
      )}
    </div>
  )
}

function FontSizeControl({ size, onChange }: { size: number; onChange: (n: number) => void }) {
  return (
    <div className={styles.fontSizeControl}>
      <button
        className={styles.fontSizeBtn}
        onClick={() => onChange(size - 1)}
        aria-label="Decrease font size"
        title="Decrease font size"
      >
        −
      </button>
      <span className={styles.fontSizeValue} aria-label={`Font size ${size}`}>{size}</span>
      <button
        className={styles.fontSizeBtn}
        onClick={() => onChange(size + 1)}
        aria-label="Increase font size"
        title="Increase font size"
      >
        +
      </button>
    </div>
  )
}

export function Toolbar({
  status, onRun, fileOpen = false, hasEditorSelection = false,
  onImport, onOpenFolder, onSave, canSave, onReload,
  autosaveEnabled, onAutosaveToggle, saveStatus, font, onFontChange, fontSize, onFontSizeChange,
  theme, onThemeToggle, bracketColorization, onBracketColorizationToggle, onAbout,
}: ToolbarProps) {
  const isLoading = status === 'loading'
  const isRunning = status === 'running'
  const isError = status === 'error'
  const disabled = !fileOpen || isLoading || isRunning || isError
  const fsaOpen = !!onSave

  const [showSaved, setShowSaved] = useState(false)
  const [themeAnimating, setThemeAnimating] = useState(false)
  useEffect(() => {
    if (saveStatus !== 'autosaved') return
    setShowSaved(true)
    const id = setTimeout(() => setShowSaved(false), 2000)
    return () => clearTimeout(id)
  }, [saveStatus])

  return (
    <header className={styles.toolbar} role="banner">

      {/* LEFT — brand + info + file menu */}
      <div className={styles.left}>
        <span className={styles.logo} aria-label="Saarai">🐍</span>
        <span className={styles.title}>Saarai</span>
        <button
          className={styles.infoButton}
          onClick={onAbout}
          title="About Saarai"
          aria-label="About Saarai"
        >
          <InfoIcon />
        </button>
        <div className={styles.dividerV} aria-hidden="true" />
        <FileMenu onImport={onImport} onOpenFolder={onOpenFolder} />
      </div>

      {/* CENTER — save / sync controls (FSA only) */}
      <div className={styles.center}>
        {fsaOpen && (
          <>
            <button
              className={`${styles.saveButton} ${canSave ? styles.saveButtonDirty : ''}`}
              onClick={onSave}
              disabled={!canSave}
              title="Save file (⌘S / Ctrl+S)"
              aria-label="Save file"
            >
              {showSaved ? 'Saved ✓' : canSave ? '● Save' : 'Save'}
            </button>
            {onReload && (
              <button
                className={styles.menuTrigger}
                onClick={onReload}
                title="Reload all files from disk"
                aria-label="Reload from disk"
              >
                Reload
              </button>
            )}
          </>
        )}
      </div>

      {/* RIGHT — font picker, font size, runtime status, run, about */}
      <div className={styles.right}>
        <FontMenu font={font} onFontChange={onFontChange} />
        <FontSizeControl size={fontSize} onChange={onFontSizeChange} />
        <button
          className={`${styles.themeButton} ${themeAnimating ? styles.themeButtonAnimating : ''}`}
          onClick={() => { setThemeAnimating(true); onThemeToggle() }}
          onAnimationEnd={() => setThemeAnimating(false)}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
        <SettingsMenu
          theme={theme}
          onThemeToggle={onThemeToggle}
          autosaveEnabled={autosaveEnabled}
          onAutosaveToggle={onAutosaveToggle}
          bracketColorization={bracketColorization}
          onBracketColorizationToggle={onBracketColorizationToggle}
        />
        <div className={styles.dividerV} aria-hidden="true" />
        <div className={styles.status} aria-live="polite">
          {isLoading && (
            <span className={styles.statusLoading}>
              <Spinner />
              Loading runtime…
            </span>
          )}
          {isRunning && <span className={styles.statusRunning}>Running…</span>}
          {status === 'ready' && <span className={styles.statusReady}>● Ready</span>}
          {isError && <span className={styles.statusError}>● Runtime error</span>}
        </div>
        <button
          className={styles.runButton}
          onClick={onRun}
          disabled={disabled}
          title={hasEditorSelection ? 'Run selection (⌘↵ / Ctrl+↵)' : 'Run code (⌘↵ / Ctrl+↵)'}
          aria-label={hasEditorSelection ? 'Run selection' : 'Run code'}
        >
          <PlayIcon />
          {hasEditorSelection ? 'Run selection' : 'Run'}
        </button>
      </div>

    </header>
  )
}
