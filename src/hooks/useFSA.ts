// Utilities for the File System Access API (Chrome/Edge only; not available in Firefox/Safari).
// https://developer.mozilla.org/en-US/docs/Web/API/File_System_API

export function fsaSupported(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

// Read all non-hidden files under a directory handle.
// Returned paths are prefixed with the directory name: "myproject/src/main.py".
export async function readDirectory(handle: FileSystemDirectoryHandle): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  await collectFiles(handle, handle.name, result)
  return result
}

async function collectFiles(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
  result: Map<string, string>,
): Promise<void> {
  for await (const [name, entry] of dirHandle.entries()) {
    if (name.startsWith('.')) continue
    const path = `${prefix}/${name}`
    if (entry.kind === 'file') {
      try {
        const file = await (entry as FileSystemFileHandle).getFile()
        result.set(path, await file.text())
      } catch {
        // skip unreadable / binary files
      }
    } else {
      await collectFiles(entry as FileSystemDirectoryHandle, path, result)
    }
  }
}

// Delete a file or directory at a path relative to dirHandle.
// Uses recursive: true so it works for directories.
export async function deleteFromDirectory(
  dirHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<void> {
  const parts = relativePath.split('/')
  let currentDir = dirHandle
  for (const part of parts.slice(0, -1)) {
    currentDir = await currentDir.getDirectoryHandle(part)
  }
  await currentDir.removeEntry(parts[parts.length - 1], { recursive: true })
}

// Create an empty directory at a path relative to dirHandle.
export async function createDirectoryInDirectory(
  dirHandle: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<void> {
  const parts = relativePath.split('/')
  let currentDir = dirHandle
  for (const part of parts) {
    currentDir = await currentDir.getDirectoryHandle(part, { create: true })
  }
}

// Write content to a path relative to dirHandle.
// e.g. dirHandle = "myproject/", relativePath = "src/main.py"
export async function writeToDirectory(
  dirHandle: FileSystemDirectoryHandle,
  relativePath: string,
  content: string,
): Promise<void> {
  const parts = relativePath.split('/')
  let currentDir = dirHandle
  for (const part of parts.slice(0, -1)) {
    currentDir = await currentDir.getDirectoryHandle(part, { create: true })
  }
  const fileHandle = await currentDir.getFileHandle(parts[parts.length - 1], { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(content)
  await writable.close()
}
