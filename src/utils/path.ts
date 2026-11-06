// Helpers for the project-relative paths used as contentMap keys and FileTree
// node paths. Paths have no leading slash; a top-level file ("untitled.py")
// has an empty parent.

/** Parent directory of `path`, or '' when `path` is at the top level. */
export function parentOf(path: string): string {
  const i = path.lastIndexOf('/')
  return i === -1 ? '' : path.slice(0, i)
}

/** Join a parent directory and a name, without a leading slash at the top level. */
export function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name
}
