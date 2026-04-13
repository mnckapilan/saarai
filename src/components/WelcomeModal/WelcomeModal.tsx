import { useEffect, useRef } from 'react'
import styles from './WelcomeModal.module.css'

interface WelcomeModalProps {
  onClose: () => void
}

export function WelcomeModal({ onClose }: WelcomeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClick={handleBackdropClick}
      onClose={onClose}
      aria-labelledby="welcome-title"
    >
      <div className={styles.content}>
        <header className={styles.header}>
          <span className={styles.logo} aria-hidden="true">🐍</span>
          <div>
            <h1 id="welcome-title" className={styles.title}>Saarai</h1>
            <p className={styles.subtitle}>A browser-based Python IDE — no installation required</p>
          </div>
        </header>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What is this?</h2>
          <p className={styles.sectionBody}>
            Saarai runs Python entirely in your browser using{' '}
            <strong>WebAssembly</strong> via{' '}
            <a
              href="https://pyodide.org"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              Pyodide
            </a>
            . There is no backend server. Code executes locally on your machine — open a file,
            write Python, and hit <kbd className={styles.kbd}>⌘↵</kbd> (or{' '}
            <kbd className={styles.kbd}>Ctrl+↵</kbd>) to run it.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.privacyIcon} aria-hidden="true">🔒</span>
            Your files stay with you
          </h2>
          <p className={styles.sectionBody}>
            Nothing you write or open is ever sent to a server. Your code, files, and output
            live only in your browser tab. Close the tab and it's gone — Saarai never sees it.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.warningIcon} aria-hidden="true">⚠</span>
            Things to know
          </h2>
          <ul className={styles.list}>
            <li>
              <strong>Don't refresh the page.</strong> Any code you've written without opening
              a file will be lost. Use <em>Open file</em> or <em>Open folder</em> to work with
              files on disk.
            </li>
            <li>
              <strong>Package support is limited.</strong> Only packages bundled with Pyodide
              (NumPy, Pandas, Matplotlib, and others) plus packages installable via{' '}
              <code className={styles.code}>micropip</code> are available. Native C extensions
              not compiled for WebAssembly won't work.
            </li>
            <li>
              <strong>Long-running scripts can be interrupted.</strong> Python runs in a background
              thread so the UI stays responsive. Use the <em>Stop</em> button to interrupt a
              running script at any time.
            </li>
            <li>
              <strong>No network access from Python.</strong> Code cannot make HTTP requests or
              open sockets — it's sandboxed inside the browser.
            </li>
            <li>
              <strong>Runtime loads on first visit.</strong> The Python runtime (~10 MB) is
              downloaded from a CDN the first time you load the page. Subsequent visits use
              the browser cache.
            </li>
          </ul>
        </section>

        <p className={styles.disclaimer}>
          Saarai is intended for educational and experimental use — not for serious production development.
        </p>

        <footer className={styles.footer}>
          <a
            href="https://github.com/mnckapilan/saarai"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.githubLink}
            aria-label="View source on GitHub"
          >
            <GitHubIcon />
            View on GitHub
          </a>
          <button className={styles.closeButton} onClick={onClose} autoFocus>
            Get started
          </button>
        </footer>
      </div>
    </dialog>
  )
}

function GitHubIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.34-3.369-1.34-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  )
}
