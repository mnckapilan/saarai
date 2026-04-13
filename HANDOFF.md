# Handoff: Python File I/O Disk Sync

## What was built

Python code running in Pyodide can now read and write files that persist beyond
the in-memory MEMFS, and the IDE keeps everything in sync.

### Features added

**1. Python-written files sync to disk and appear in the file tree**

After each Python run, the worker (`pyodide.worker.ts`) scans MEMFS for files
that are new or modified compared to the pre-run snapshot (`mountedSnapshot`).
Any changed files are reported via a `filesWritten` worker message. The IDE
(`IDE.tsx`) receives this in a `useEffect` watching `writtenFiles` state (from
`usePyodide`), updates `contentMapRef` (so the file tree shows new files), and
writes them to real disk via the FSA handle if a folder is open.

**2. Save-on-run**

`handleRun` now `await`s `handleSaveRef.current()` before calling `runCode`.
This ensures the active file is saved to disk AND patched into MEMFS before
Python executes, so edits in Monaco are always visible to Python imports/reads.

### Files changed

| File | What changed |
|---|---|
| `src/pyodide.worker.ts` | Added `OutMessage.filesWritten`, `mountedSnapshot`, `scanMemFS()`, post `filesWritten` after each run, snapshot after mount |
| `src/hooks/usePyodide.ts` | Added `writtenFiles` state, handle `filesWritten` message, expose in return value |
| `src/components/IDE/IDE.tsx` | `useEffect` on `writtenFiles` to write files to disk + update file tree; `handleRun` awaits save |
| `src/hooks/usePyodide.test.ts` | Added mock `writtenFiles` support, two new unit tests |
| `tests/execution.spec.ts` | Added `mockShowDirectoryPicker` FSA helper, two new e2e tests, one write+read test |

### How file sync works end-to-end

```
Python run completes
  └── worker: scanMemFS() → diff vs mountedSnapshot → post filesWritten
        └── usePyodide: setWrittenFiles(files)
              └── IDE useEffect:
                    ├── contentMapRef.current.set(key, content)   ← file tree update
                    ├── writeToDirectory(fsaHandle, relPath, content)  ← disk write (FSA only)
                    └── refreshFileTree()
```

### Limitations / known issues

- Binary files written by Python are skipped (only text files are synced)
- Files written outside `/project/` are not tracked
- Without a folder open via FSA (single file mode or webkitdirectory fallback),
  Python-written files appear in the file tree but are NOT persisted to disk
- Disk edits are only picked up via "Reload from disk" (no file watching)

## Outstanding test failure

The Playwright test **"Python writes a file to disk; external edit is picked up
on reload; second script reads updated content"** is still being debugged.

### What the test does

1. Mocks `showDirectoryPicker` (FSA) with a duck-typed handle backed by a real
   temp directory (using `page.exposeFunction` to bridge Node.js `fs` calls)
2. Runs `writer.py` → Python writes `data.txt` → FSA mock writes it to disk
3. Verifies `data.txt` content on disk via `__fsRead`
4. Opens `data.txt` in the editor (makes it the active file)
5. Overwrites `data.txt` on disk externally
6. Triggers "Reload from disk" (with `window.confirm` overridden to return true)
7. Polls Monaco until the editor shows the updated content (reliable completion signal)
8. Runs `reader.py` → asserts output contains updated content

### What's failing

The test is verified up to step 6 (`Reload from disk` click) but the Monaco
value poll (step 7) may still not reflect the update reliably. The root cause
is uncertain — possibilities:

- `handleReload` bailing silently (try-catch suppresses errors)
- `readDirectory` failing with the mock during reload (second call)
- Race between FSA mock async IPC calls and the test proceeding

### Debugging steps to try next

1. Add a `page.on('console', msg => ...)` listener in the test's `beforeEach`
   to capture any `console.error` from `handleReload`'s catch block:
   ```ts
   page.on('console', msg => {
     if (msg.type() === 'error') console.error('PAGE:', msg.text())
   })
   ```
2. Add a temporary `console.log` inside `handleReload` after `window.confirm()`
   to confirm it's running (remove before merging)
3. Check if `readDirectory` is returning 0 files on the second call (our mock's
   `__fsReadDir` might be failing on the second invocation)
4. Consider whether the mock needs to be re-installed before Reload (the handle
   stored in `dirHandleRef.current` uses closures from the original `page.evaluate`
   — verify these closures are still alive for async generator calls)

### Second FSA test (Monaco editing)

The second test in the `disk round-trip via FSA` describe block ("file written
by Python can be edited in Monaco...") has not been run against a live browser
yet. It should work once the reload signal issue is resolved, but may need
similar debugging.
