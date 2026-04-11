# Python Web IDE

A browser-based Python IDE — no install, no server, no account. Write and run Python entirely in the browser using WebAssembly.

## Features

### Editor
- **Monaco Editor** — the same editor that powers VS Code, with full Python syntax highlighting
- **Run with one click** or `Cmd+Enter` / `Ctrl+Enter` from anywhere in the app
- **12 monospace fonts** to choose from (JetBrains Mono, Fira Code, Cascadia Code, and more), persisted across sessions

### Python runtime
- **Pyodide** — CPython compiled to WebAssembly, runs entirely in-browser with no backend
- Full Python standard library available
- `stdout` and `stderr` streamed to the output panel in real time, colour-coded by type

### File & folder import
- **Open file** — import a single `.py` or `.txt` file into the editor
- **Open folder** — import a whole project directory; hidden files and directories (dot-prefixed) are automatically excluded
- Imported files are written into **Pyodide's in-memory filesystem** (`/project/`) so Python code can use `open()`, relative imports, and `import` across modules at runtime
- The working directory is set to the project root so multi-file projects work out of the box

### File explorer
- Navigable **file tree** in a resizable left panel
- Folders expand and collapse; only the top-level folder starts expanded
- Click any file to load it into the editor; the active file is highlighted
- Drag the panel divider to resize the explorer, editor, or output areas

### Output panel
- Colour-coded output: `stdout` (light), `stderr` (red), runtime info (blue)
- One-click clear button

## Stack

| Layer | Technology |
|---|---|
| UI | React 18 + TypeScript |
| Build | Vite |
| Editor | Monaco Editor (CDN) |
| Python | Pyodide 0.26.4 (CDN) |
| Layout | react-resizable-panels |
| Styles | CSS Modules + CSS custom properties |
| Tests | Playwright |

## Development

```bash
# Dev server (requires Node 24 via nvm)
~/.nvm/versions/node/v24.14.1/bin/npm run dev

# Production build
~/.nvm/versions/node/v24.14.1/bin/npm run build

# TypeScript type-check
~/.nvm/versions/node/v24.14.1/bin/npm run type-check

# End-to-end tests
~/.nvm/versions/node/v24.14.1/bin/npm test
```
