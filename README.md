# 🐍 Saarai – Web Python IDE

A browser-based Python IDE — no install, no server, no account. Write and run Python entirely in the browser using WebAssembly.

**Why Saarai?** 🐍 Named after *saarai paambu* (சாரைப்பாம்பு), the Tamil name for the Indian rat snake (*Ptyas mucosa*) — a large, fast, non-venomous snake common across South Asia. Keeping with the Python theme.

## Features

### Editor
- **Monaco Editor** — the same editor that powers VS Code, with full Python syntax highlighting
- **Run with one click** or `Cmd+Enter` / `Ctrl+Enter` from anywhere in the app
- **Run selection** — select any region and run just that code
- **Stop execution** — interrupt a running script at any time with the Stop button
- **12 monospace fonts** to choose from (JetBrains Mono, Fira Code, Cascadia Code, and more), persisted across sessions
- Adjustable font size, persisted across sessions
- Cursor position shown in the status bar

### Python runtime
- **Pyodide** — CPython compiled to WebAssembly, runs entirely in-browser with no backend
- Runs in a **Web Worker** so the UI stays fully responsive during execution
- Full Python standard library available
- `stdout` and `stderr` streamed to the output panel in real time, colour-coded by type
- Clean, readable tracebacks — Pyodide internals are filtered out and real filenames are shown

### File & folder import
- **Open file** — import a single `.py` or `.txt` file into the editor
- **Open folder** — import a whole project directory via the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API) (Chrome/Edge) or `<input webkitdirectory>` fallback; hidden dot-prefixed paths are excluded
- Imported files are written into **Pyodide's in-memory filesystem** (`/project/`) so Python code can use `open()`, relative imports, and `import` across modules at runtime
- The working directory is set to the project root so multi-file projects work out of the box
- **Save** edited files back to disk (FSA API only), with **autosave** every 5 seconds (toggleable)
- **Reload from disk** to pick up external changes

### File explorer
- Navigable **file tree** in a resizable left panel
- Create, rename, and delete files and folders directly in the tree
- Click any file to load it into the editor; unsaved files are marked with a dot
- Drag the panel divider to resize the explorer, editor, or output areas

### Output panel
- Colour-coded output: `stdout` (white), `stderr` (red), runtime info (blue)
- One-click clear button

### Settings & appearance
- Light / dark theme toggle, persisted across sessions
- Bracket pair colorization toggle
- Settings accessible from the toolbar or the ⚙ icon

## Stack

| Layer | Technology |
|---|---|
| UI | React 18 + TypeScript |
| Build | Vite |
| Editor | Monaco Editor (npm) |
| Python | Pyodide 0.26.4 (CDN, Web Worker) |
| Layout | react-resizable-panels |
| Styles | CSS Modules + CSS custom properties |
| Unit tests | Vitest + Testing Library |
| E2E tests | Playwright |

## Development

```bash
# Dev server (requires Node 24 via nvm)
~/.nvm/versions/node/v24.14.1/bin/npm run dev

# Production build
~/.nvm/versions/node/v24.14.1/bin/npm run build

# TypeScript type-check
~/.nvm/versions/node/v24.14.1/bin/npm run type-check

# Unit tests (Vitest)
~/.nvm/versions/node/v24.14.1/bin/npm test

# Unit tests in watch mode
~/.nvm/versions/node/v24.14.1/bin/npm run test:watch

# End-to-end tests (Playwright)
~/.nvm/versions/node/v24.14.1/bin/npm run test:e2e
```
