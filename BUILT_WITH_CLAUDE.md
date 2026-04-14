# How I Built Saarai with Claude Code

Saarai is a browser-based Python IDE: Monaco Editor for code editing, Pyodide (Python compiled to WebAssembly) for execution — all in the browser, no backend. Built over ~96 commits using Claude Code as the primary development tool.

---

## What the project is

A single-page React + TypeScript app where you can write and run Python entirely in the browser. Features include:

- Python execution via Pyodide (WASM), running in a Web Worker
- A file tree with create/rename/delete, mirrored into Pyodide's virtual filesystem
- Write-back to your real disk via the File System Access API (Chrome/Edge)
- Autosave, light/dark theme, font size control, settings modal
- Jupyter notebook support (.ipynb)
- Stop button that interrupts running code via SharedArrayBuffer
- Clean Python tracebacks (strips Pyodide internals, shows real filenames)
- Deployed on Cloudflare Pages, tested with Vitest + Playwright

---

## How the process worked

Every feature was built on a separate branch and merged as a PR — Claude proposed the implementation, I reviewed it, and we iterated until it was right. Claude also maintained `CLAUDE.md`: a living document describing the architecture, key design decisions, and how to run everything. This meant that context carried across sessions without me having to re-explain the codebase each time.

The git history tells the story pretty clearly — features were built in logical layers, bottom-up.

---

## What went smoothly

**Greenfield features with clear specs.** When I knew exactly what I wanted, Claude executed quickly with minimal back-and-forth:
- File operations (new file/folder, rename, delete) — one PR, clean
- Autosave with toggle and status indicators — one PR
- Per-file Monaco models (preserving undo history, cursor, scroll per file) — one PR
- Run highlighted/selected text — one PR
- Light mode with VS Code Light Modern palette — one PR
- Settings modal dialog — clean, with unit tests included
- Jupyter notebook support (.ipynb) — one PR

**Testing.** Claude added Playwright e2e tests alongside almost every major feature — the Stop button, error formatting, reload from disk, import behaviour. The tests were well-structured and actually caught real issues. Vitest unit tests were wired into CI early and kept up to date.

**Design and polish.** The toolbar redesign, VS Code status bar aesthetic, design token system, and CSS Modules structure were all handled well. Claude proposed a clean token system (`tokens.css` + per-component `.module.css`) and applied it consistently.

**Architecture documentation.** Every time a significant architectural decision was made, Claude updated `CLAUDE.md` to explain why — e.g., why Pyodide is loaded from CDN instead of bundled, why `pyodide` is excluded from Vite's `optimizeDeps`, how the interrupt mechanism works. This was genuinely useful.

---

## What was harder and took more iterations

**Cross-Origin isolation headers (COEP/COOP) in production.**
This was the biggest pain point. `SharedArrayBuffer` (needed for the Stop button interrupt mechanism) requires the page to be served with specific HTTP headers: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Getting those headers right on Cloudflare Pages took 4+ commits:

1. Added headers — but they broke Pyodide's CDN assets loading (COEP `require-corp` blocks cross-origin assets that don't opt in)
2. Had to add `Cross-Origin-Resource-Policy` headers for same-origin assets
3. Switched COEP from `require-corp` to `credentialless` to allow CDN resources (Pyodide, jsDelivr) to load without requiring them to opt in
4. Then separately hit a Cloudflare static asset serving quirk that required inlining the worker — then reverting that because it broke dynamic imports inside the worker

The COEP/COOP dance is genuinely fiddly and not something Claude just knew off the top of its head — it required iterating on the real failure modes.

**Worker bundling.**
Moving Pyodide from the main thread to a Web Worker (`pyodide.worker.ts`) was a significant refactor. The worker format had to be `es` (ES modules) in Vite config for dynamic imports to work inside it. There was also a detour where the worker was inlined (to work around a Cloudflare COEP header issue) and then reverted because inlining broke Pyodide's dynamic `import()` calls.

**Monaco bundling.**
Monaco Editor has its own quirks: by default `@monaco-editor/react` fetches Monaco from CDN at runtime, but that's hard to cache-bust and adds latency. Bundling it as a proper npm dep required configuring `loader.config({ monaco })` to point the React wrapper at the local copy, and splitting it into its own Vite chunk so the main bundle didn't balloon. The unit test mock for `monaco-editor` was a separate fix needed after.

**Making Python `import` work reliably.**
When a folder is mounted into Pyodide's MEMFS, `sys.path` and `os.chdir` have to be set correctly so that relative imports and `open()` calls work. Getting the cwd and path setup right — especially ordering it correctly relative to when Pyodide finishes loading — required a dedicated fix commit.

---

## What the CLAUDE.md file does

`CLAUDE.md` is a file in the repo root that Claude Code reads at the start of every session. It contains:

- How to run dev server, build, and tests (including a workaround for nvm not working in Claude's shell environment — had to use the full binary path)
- The full data flow diagram showing how components connect
- Explanations of every non-obvious design decision and *why* it was made

Maintaining this file was one of the highest-leverage things in the workflow. Claude updated it whenever something architectural changed, which meant subsequent sessions started with full context rather than requiring re-explanation.

---

## Summary

The project took ~96 commits to go from blank slate to a fully featured browser IDE with CI, tests, and production deployment. Features with clear requirements shipped fast — often one PR, one session. The hardest parts were browser API edge cases (COEP/COOP headers, SharedArrayBuffer availability, worker module format) where there's no substitute for actually hitting the failure and reading the error. Claude handled those iteratively and documented the decisions once they were resolved.

The thing that made the biggest difference to productivity: keeping `CLAUDE.md` accurate so that each new session started from a correct mental model of the codebase.
