# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands must be run using the Node 24 binary directly (nvm shell integration doesn't work in this environment):

```bash
# Dev server
~/.nvm/versions/node/v24.14.1/bin/npm run dev

# Production build
~/.nvm/versions/node/v24.14.1/bin/npm run build

# TypeScript type-check (no emit)
~/.nvm/versions/node/v24.14.1/bin/npm run type-check
```

Unit tests (Vitest) live in `src/`. Run with `~/.nvm/versions/node/v24.14.1/bin/npm test`.

Playwright e2e tests live in `tests/`. Run with `~/.nvm/versions/node/v24.14.1/bin/npm run test:e2e`.

## Architecture

A single-page React + TypeScript app built with Vite. The app is a browser-based Python IDE: Monaco Editor for code editing, Pyodide (Python compiled to WebAssembly) for execution.

### Data flow

```
IDE (state owner)
 ├── usePyodide()        ← manages Pyodide lifecycle, MEMFS, execution
 │    └── pyodide npm    ← WASM files load from CDN at runtime (indexURL)
 ├── Toolbar             ← receives status + onRun + onImport + onOpenFolder + save/reload/autosave
 ├── FileTree            ← navigable folder/file tree, fires onFileSelect; supports create/rename/delete
 ├── Editor (Monaco)     ← owns code string, fires onRun via Cmd+Enter; exposes EditorHandle ref
 └── OutputPanel         ← receives OutputLine[] array
```

`usePyodide` is the core hook. It dynamically imports pyodide, initialises the runtime with CDN `indexURL`, wires `stdout`/`stderr` callbacks to React state, and exposes `runCode(code, scriptDir?)`, `clearOutput()`, `mountFiles(contents, cwd)`, and `patchFile(memfsPath, content)`. Pyodide runs on the **main thread** (no Web Worker) — a noted future improvement.

### File save (File System Access API)

When a folder is opened via `showDirectoryPicker()` (Chrome/Edge), `IDE` holds a `FileSystemDirectoryHandle`. Save writes back via `writeToDirectory`, reload re-reads via `readDirectory`. Autosave runs on a 5-second interval. The `<input webkitdirectory>` fallback is used in browsers without FSA support (Firefox, Safari) — read-only, no save.

### File / folder import

- **Single file** (`Open file`): reads the file via `file.text()`, sets editor content, and writes it to Pyodide's MEMFS at `/project/<filename>` with cwd `/project`.
- **Folder** (`Open folder`): uses `<input webkitdirectory>`. All visible files (hidden dot-prefixed paths are skipped) are read eagerly with `Promise.allSettled` — unreadable files are silently skipped. The full tree is written to `/project/` and cwd is set to `/project/<rootFolder>`, so `import` and `open()` work relative to the project root.
- `mountFiles` in `usePyodide` handles MEMFS writes: wipes `/project/`, recreates the directory tree via `pyodide.FS`, writes each file, then calls `os.chdir` + updates `sys.path`. If Pyodide is still loading when called, it polls until ready (up to 30 s).

### Key design decisions

- **Pyodide CDN loading**: `indexURL` points to `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/`. The npm package is installed only for TypeScript types; WASM/stdlib files never enter the bundle. The CDN version must match the npm package version.
- **Monaco CDN loading**: `loader.config({ paths: { vs: '...' } })` in `Editor.tsx` loads Monaco from jsDelivr. This avoids the complex Vite worker setup required when bundling Monaco locally (`monaco-editor` is not installed as a dep).
- **CSS Modules + CSS custom properties**: All design tokens live in `src/styles/tokens.css` and are imported via `src/index.css`. Component styles use `.module.css` files co-located with their component.
- **`vite.config.ts`** excludes `pyodide` from `optimizeDeps` — required to prevent Vite from trying to pre-bundle Pyodide's Node-specific internals.
- **Vite build warnings** about `node:url`, `node:fs` etc. from pyodide are expected and harmless — Pyodide detects the browser environment at runtime.
- **`EditorHandle`**: `Editor` forwards a ref exposing `getSelectedText()` (used by "Run selection") and `disposeModel(path)` (used when files are renamed/deleted to avoid stale Monaco models).

### Playwright e2e notes

- Tests run against the Vite dev server (`npm run dev`). Kill any existing server on port 5173 before running e2e tests to ensure a fresh server is used — `reuseExistingServer` can pick up a stale process.
- Execution tests (`tests/execution.spec.ts`) load Pyodide from CDN; allow up to 50 s for the runtime-ready state.
