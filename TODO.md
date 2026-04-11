# TODO

Future improvements for the Python Web IDE.

## File Tree
- [ ] #1 Icons for file types
- [ ] #2 File operations (rename, delete)
- [ ] #3 New file / new folder

## Editor
- [ ] #4 Keyboard shortcuts
- [ ] #5 Find & replace (Cmd+F / Cmd+H)
- [ ] #6 Multiple editor tabs
- [ ] #7 Split pane layout (editor + output side by side)
- [ ] #8 Font size / editor settings panel
- [ ] #9 Basic LSP support

## Execution
- [ ] #10 Stop / interrupt running code
- [ ] #11 `input()` / stdin support
- [ ] #12 matplotlib / rich output rendering (plots, images)

## Packages
- [ ] #13 micropip integration — install PyPI packages from the UI

## File System Write-back
- [x] #22 Write modified files back to disk via the File System Access API

  **Plan:**
  1. **Switch folder import to `showDirectoryPicker()`** instead of `<input webkitdirectory>`. This returns a `FileSystemDirectoryHandle` the browser lets us write through. Store the handle in a React ref alongside the current MEMFS contents.
  2. **Track dirty files in MEMFS.** After each `runCode`, diff the MEMFS contents against the original snapshot (or intercept `FS.writeFile` / `FS.open` calls) to know which paths changed.
  3. **Add a "Save" action** (Cmd+S / toolbar button). On save, iterate dirty paths, resolve each via `directoryHandle.getFileHandle(path, { create: true })`, open a `FileSystemWritableFileStream`, write the MEMFS content, and close the stream.
  4. **Handle new files and deletes.** New paths not in the original snapshot need `create: true`; deleted paths (tracked via MEMFS `unlink` hooks or an explicit delete UI action from #2/#3) call `directoryHandle.removeEntry(path)`.
  5. **Permission handling.** `showDirectoryPicker` requires a user gesture and may need `handle.requestPermission({ mode: 'readwrite' })` re-checked on page focus. Show a permission-denied state gracefully.
  6. **Fallback.** `window.showDirectoryPicker` is not available in Firefox or Safari. Keep the existing `<input webkitdirectory>` path as a fallback (read-only mode), and surface a banner when write-back isn't supported.

## Persistence & Sharing
- [ ] #14 Save files to localStorage (survive page refresh)
- [ ] #15 Share code via URL (encode in hash/query param)
- [ ] #16 Export project as .zip

## Output
- [ ] #17 Clear output button
- [ ] #18 Visual distinction between stdout and stderr
- [ ] #19 Copy output to clipboard

## UX
- [ ] #20 Dark / light theme toggle
- [ ] #21 Mobile-friendly layout
