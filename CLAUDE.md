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

There are no tests yet — this is an MVP (v0).

## Architecture

A single-page React + TypeScript app built with Vite. The app is a browser-based Python IDE: Monaco Editor for code editing, Pyodide (Python compiled to WebAssembly) for execution.

### Data flow

```
IDE (state owner)
 ├── usePyodide()        ← manages Pyodide lifecycle + execution
 │    └── pyodide npm    ← WASM files load from CDN at runtime (indexURL)
 ├── Toolbar             ← receives status + onRun
 ├── Editor (Monaco)     ← owns code string, fires onRun via Cmd+Enter
 └── OutputPanel         ← receives OutputLine[] array
```

`usePyodide` is the core hook. It dynamically imports pyodide, initialises the runtime with CDN `indexURL`, wires `stdout`/`stderr` callbacks to React state, and exposes `runCode(code)` + `clearOutput()`. Pyodide runs on the **main thread** (no Web Worker) — a noted future improvement.

### Key design decisions

- **Pyodide CDN loading**: `indexURL` points to `https://cdn.jsdelivr.net/pyodide/v0.26.4/full/`. The npm package is installed only for TypeScript types; WASM/stdlib files never enter the bundle. The CDN version must match the npm package version.
- **Monaco CDN loading**: `loader.config({ paths: { vs: '...' } })` in `Editor.tsx` loads Monaco from jsDelivr. This avoids the complex Vite worker setup required when bundling Monaco locally (`monaco-editor` is not installed as a dep).
- **CSS Modules + CSS custom properties**: All design tokens live in `src/styles/tokens.css` and are imported via `src/index.css`. Component styles use `.module.css` files co-located with their component.
- **`vite.config.ts`** excludes `pyodide` from `optimizeDeps` — required to prevent Vite from trying to pre-bundle Pyodide's Node-specific internals.
- **Vite build warnings** about `node:url`, `node:fs` etc. from pyodide are expected and harmless — Pyodide detects the browser environment at runtime.
