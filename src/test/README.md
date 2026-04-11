# Testing strategy

## Commands

```bash
# Run all unit tests once
~/.nvm/versions/node/v24.14.1/bin/npm run test:unit

# Watch mode (re-runs on file save)
~/.nvm/versions/node/v24.14.1/bin/npm run test:unit:watch

# Interactive browser UI
~/.nvm/versions/node/v24.14.1/bin/npm run test:unit:ui

# End-to-end tests (requires dev server)
~/.nvm/versions/node/v24.14.1/bin/npm test
```

## Two test layers

This project uses two test frameworks for different reasons.

**Vitest** (unit/component) — tests in `src/`, co-located with source files as `*.test.ts` / `*.test.tsx`. Runs in jsdom. Fast, no browser required, no network.

**Playwright** (E2E) — tests in `tests/`. Spins up a real Chromium browser against the dev server. Used for anything that requires Monaco Editor or Pyodide, since both load from CDN and cannot be meaningfully mocked.

## What to test where

### Write a Vitest test when...

**The logic doesn't need a real browser.**

| Thing | What to test |
|---|---|
| Pure utility functions | All code paths, edge cases, error handling |
| Hooks | State transitions, side effects (localStorage, DOM), cleanup on unmount |
| Simple components | Rendering, conditional display, prop-driven behaviour, user interactions |

Good candidates: anything in `src/hooks/` or `src/components/` that doesn't directly invoke Monaco or Pyodide. If you can drive it with props and mock functions, test it here.

**Mock Pyodide** when testing hooks or components that depend on it — the mock lives in `src/hooks/usePyodide.test.ts` as a reference. The real Pyodide loads ~10 MB from CDN; never let it into unit tests.

**Don't mock Monaco** — components that touch the editor (`Editor.tsx`, anything that reads `window.monaco`) belong in Playwright, not here. The mocking cost exceeds the value.

### Write a Playwright test when...

- The feature requires Monaco Editor (typing, editor state, model management)
- The feature requires Pyodide (code execution, MEMFS, stdout/stderr)
- You need to test file picker interactions (`<input type="file">`, `webkitdirectory`)
- You need to verify the full data flow end-to-end (import file → editor updates → run → output)

### Don't test at all

- CSS class names or visual layout — use your eyes or a screenshot tool
- Third-party library internals (Monaco, Pyodide, react-resizable-panels)
- Code that is already type-checked — TypeScript covers structural correctness; don't duplicate that with runtime assertions

## File layout

Tests live next to the code they test:

```
src/
  hooks/
    useFont.ts
    useFont.test.ts          ← tests for useFont
    useFSA.ts
    useFSA.test.ts
    usePyodide.ts
    usePyodide.test.ts
    useKeyboardShortcut.ts
    useKeyboardShortcut.test.ts
  components/
    OutputPanel/
      OutputPanel.tsx
      OutputPanel.test.tsx   ← tests for OutputPanel
    FileTree/
      FileTree.tsx
      FileTree.test.tsx
    Toolbar/
      Toolbar.tsx
      Toolbar.test.tsx
  test/
    setup.ts                 ← global test setup (jest-dom, jsdom stubs)
    README.md                ← this file
tests/
  import.spec.ts             ← Playwright E2E tests
```

## Setup file (`src/test/setup.ts`)

Runs before every Vitest test file. Currently stubs two things that jsdom doesn't implement:

- `Element.prototype.scrollIntoView` — used by `OutputPanel` to auto-scroll to the latest line
- `window.localStorage` — jsdom's implementation is incomplete in some environments; replaced with a working in-memory stub

If a new test fails because a browser API is missing in jsdom, add the stub here rather than in individual test files.
