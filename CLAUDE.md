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
 ├── usePyodide()        ← manages Worker lifecycle + message protocol; owns output state
 │    └── pyodide.worker.ts  ← Web Worker: loads Pyodide from CDN, runs code, manages MEMFS
 ├── Toolbar             ← receives status + onRun + onStop + onImport + onOpenFolder + save/reload/autosave
 ├── FileTree            ← navigable folder/file tree, fires onFileSelect; supports create/rename/delete
 ├── Editor (Monaco)     ← owns code string, fires onRun via Cmd+Enter; exposes EditorHandle ref
 └── OutputPanel         ← receives OutputLine[] array
```

`usePyodide` is the core hook. It creates a `pyodide.worker.ts` Web Worker, communicates via `postMessage`, and exposes `runCode(code, scriptDir?, scriptPath?)`, `interrupt()`, `clearOutput()`, `mountFiles(contents, cwd)`, and `patchFile(memfsPath, content)`. The worker owns all Pyodide logic: loading from CDN, MEMFS writes, and streaming `stdout`/`stderr` back as messages.

**Interrupt mechanism**: `usePyodide` creates a `SharedArrayBuffer`-backed `Uint8Array` (when `crossOriginIsolated` is available) and passes it to the worker on init. The worker calls `pyodide.setInterruptBuffer(buf)`. Clicking Stop calls `Atomics.store(buf, 0, 2)`, which Pyodide detects between Python opcodes and raises `KeyboardInterrupt`. When `SharedArrayBuffer` is unavailable, the worker is terminated and restarted as a fallback.

### File save (File System Access API)

When a folder is opened via `showDirectoryPicker()` (Chrome/Edge), `IDE` holds a `FileSystemDirectoryHandle`. Save writes back via `writeToDirectory`, reload re-reads via `readDirectory`. Autosave runs on a 5-second interval. The `<input webkitdirectory>` fallback is used in browsers without FSA support (Firefox, Safari) — read-only, no save.

### File / folder import

- **Single file** (`Open file`): reads the file via `file.text()`, sets editor content, and writes it to Pyodide's MEMFS at `/project/<filename>` with cwd `/project`.
- **Folder** (`Open folder`): uses `<input webkitdirectory>`. All visible files (hidden dot-prefixed paths are skipped) are read eagerly with `Promise.allSettled` — unreadable files are silently skipped. The full tree is written to `/project/` and cwd is set to `/project/<rootFolder>`, so `import` and `open()` work relative to the project root.
- `mountFiles` in `usePyodide` posts a `mountFiles` message to the worker. The worker handles MEMFS writes: wipes `/project/`, recreates the directory tree via `pyodide.FS`, writes each file, then calls `os.chdir` + updates `sys.path`. Messages sent before Pyodide finishes loading are queued in the worker and replayed once ready.

### Key design decisions

- **Pyodide CDN loading**: `indexURL` points to `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/`. The npm package is installed only for TypeScript types; WASM/stdlib files never enter the bundle. The CDN version must match the npm package version.
- **Monaco npm bundling**: `monaco-editor` and `@monaco-editor/react` are installed as npm deps. `Editor.tsx` calls `loader.config({ monaco: monacoEditor })` to pass the local npm instance to the `@monaco-editor/react` loader, bypassing its default CDN fetch. The `monaco` chunk is split out in `vite.config.ts` via `manualChunks` to keep the main bundle lean.
- **CSS Modules + CSS custom properties**: All design tokens live in `src/styles/tokens.css` and are imported via `src/index.css`. Component styles use `.module.css` files co-located with their component.
- **`vite.config.ts`** excludes `pyodide` from `optimizeDeps` — required to prevent Vite from trying to pre-bundle Pyodide's Node-specific internals. Also sets `worker.format: 'es'` so dynamic imports work inside the worker, and adds `Cross-Origin-Opener-Policy: same-origin` / `Cross-Origin-Embedder-Policy: require-corp` headers to the dev server to enable `crossOriginIsolated` (required for `SharedArrayBuffer`).
- **Vite build warnings** about `node:url`, `node:fs` etc. from pyodide are expected and harmless — Pyodide detects the browser environment at runtime.
- **`EditorHandle`**: `Editor` forwards a ref exposing `getSelectedText()` (used by "Run selection") and `disposeModel(path)` (used when files are renamed/deleted to avoid stale Monaco models).
- **Error formatting**: `pyodide.worker.ts` contains `formatPythonError()` which strips the `PythonError:` JS wrapper, filters internal `/_pyodide/` stack frames, and removes the `/project/` MEMFS prefix from file paths so tracebacks show clean, user-relevant output. The `filename` option of `runPythonAsync` is set to the active file's MEMFS path so Python can display real filenames and source lines in tracebacks.

### Playwright e2e notes

- Tests run against the Vite dev server (`npm run dev`). Kill any existing server on port 5173 before running e2e tests to ensure a fresh server is used — `reuseExistingServer` can pick up a stale process.
- Execution tests (`tests/execution.spec.ts`) load Pyodide from CDN; allow up to 50 s for the runtime-ready state.
