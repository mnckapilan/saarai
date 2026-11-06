// Persistence for the in-memory "scratch" workspace created via File → New file.
// Only scratch workspaces are persisted; opened files/folders are not.

export const SCRATCH_KEY = 'saarai:scratch'
export const SCRATCH_FILE = 'untitled.py'

export interface ScratchState {
  files: [string, string][]
  emptyDirs: string[]
  active: string | null
}

export function loadScratch(): ScratchState | null {
  try {
    const raw = localStorage.getItem(SCRATCH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ScratchState>
    if (!Array.isArray(parsed.files)) return null
    const files = parsed.files.filter(
      (e): e is [string, string] =>
        Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string',
    )
    const emptyDirs = Array.isArray(parsed.emptyDirs)
      ? parsed.emptyDirs.filter((d): d is string => typeof d === 'string')
      : []
    if (files.length === 0 && emptyDirs.length === 0) return null
    const active =
      typeof parsed.active === 'string' && files.some(([p]) => p === parsed.active)
        ? parsed.active
        : null
    return { files, emptyDirs, active }
  } catch {
    return null
  }
}

export function saveScratch(state: ScratchState): void {
  try {
    if (state.files.length === 0 && state.emptyDirs.length === 0) {
      localStorage.removeItem(SCRATCH_KEY)
    } else {
      localStorage.setItem(SCRATCH_KEY, JSON.stringify(state))
    }
  } catch {
    // Quota exceeded or storage unavailable — scratch just won't persist.
  }
}

export function clearScratch(): void {
  try {
    localStorage.removeItem(SCRATCH_KEY)
  } catch {
    // ignore
  }
}
