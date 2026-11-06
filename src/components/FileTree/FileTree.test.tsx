import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileTree } from './FileTree'
import type { FileNode } from '../../types'

const noop = () => {}

const fileNode: FileNode = { name: 'main.py', path: 'project/main.py', type: 'file' }
const dirNode: FileNode = {
  name: 'src',
  path: 'project/src',
  type: 'directory',
  children: [{ name: 'utils.py', path: 'project/src/utils.py', type: 'file' }],
}

describe('FileTree', () => {
  it('shows empty state when there are no nodes', () => {
    render(<FileTree nodes={[]} activeFilePath={null} onFileSelect={noop} onOpenFolder={noop} />)
    expect(screen.getByText(/No folder opened/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Open Folder/i })).toBeInTheDocument()
  })

  it('calls onOpenFolder when Open Folder button is clicked', async () => {
    const onOpenFolder = vi.fn()
    render(<FileTree nodes={[]} activeFilePath={null} onFileSelect={noop} onOpenFolder={onOpenFolder} />)
    await userEvent.click(screen.getByRole('button', { name: /Open Folder/i }))
    expect(onOpenFolder).toHaveBeenCalledOnce()
  })

  it('renders file names', () => {
    render(<FileTree nodes={[fileNode]} activeFilePath={null} onFileSelect={noop} onOpenFolder={noop} />)
    expect(screen.getByText('main.py')).toBeInTheDocument()
  })

  it('renders directory names', () => {
    render(<FileTree nodes={[dirNode]} activeFilePath={null} onFileSelect={noop} onOpenFolder={noop} />)
    expect(screen.getByText('src')).toBeInTheDocument()
  })

  it('calls onFileSelect with the file path when a file is clicked', async () => {
    const onFileSelect = vi.fn()
    render(<FileTree nodes={[fileNode]} activeFilePath={null} onFileSelect={onFileSelect} onOpenFolder={noop} />)
    await userEvent.click(screen.getByText('main.py'))
    expect(onFileSelect).toHaveBeenCalledWith('project/main.py')
  })

  it('shows children of a root directory (expanded by default at depth 0)', () => {
    render(<FileTree nodes={[dirNode]} activeFilePath={null} onFileSelect={noop} onOpenFolder={noop} />)
    expect(screen.getByText('utils.py')).toBeInTheDocument()
  })

  it('marks the active file with aria-current', () => {
    render(
      <FileTree nodes={[fileNode]} activeFilePath="project/main.py" onFileSelect={noop} onOpenFolder={noop} />,
    )
    const fileRow = screen.getByText('main.py').closest('[role="button"]')
    expect(fileRow).toHaveAttribute('aria-current', 'true')
  })

  it('does not mark a non-active file with aria-current', () => {
    render(
      <FileTree nodes={[fileNode]} activeFilePath={null} onFileSelect={noop} onOpenFolder={noop} />,
    )
    const fileRow = screen.getByText('main.py').closest('[role="button"]')
    expect(fileRow).not.toHaveAttribute('aria-current')
  })
})

describe('FileTree — header New file parent', () => {
  const scratchNode: FileNode = { name: 'untitled.py', path: 'untitled.py', type: 'file' }
  const projNode: FileNode = { name: 'proj', path: 'proj', type: 'directory', children: [] }

  function makeOps() {
    return { onCreateFile: vi.fn(), onCreateFolder: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() }
  }

  it('creates at top level (not "untitled.p") with only top-level files', async () => {
    const ops = makeOps()
    render(
      <FileTree nodes={[scratchNode]} activeFilePath={null} onFileSelect={noop} onOpenFolder={noop} ops={ops} />,
    )
    await userEvent.click(screen.getByTitle('New file'))
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
    await userEvent.type(input, 'name.py{Enter}')
    expect(ops.onCreateFile).toHaveBeenCalledExactlyOnceWith('', 'name.py')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('uses empty parent when the active file is top-level', async () => {
    const ops = makeOps()
    render(
      <FileTree nodes={[scratchNode]} activeFilePath="untitled.py" onFileSelect={noop} onOpenFolder={noop} ops={ops} />,
    )
    await userEvent.click(screen.getByTitle('New file'))
    await userEvent.type(screen.getByRole('textbox'), 'other.py{Enter}')
    expect(ops.onCreateFile).toHaveBeenCalledExactlyOnceWith('', 'other.py')
  })

  it('creates a folder at top level via header New folder', async () => {
    const ops = makeOps()
    render(
      <FileTree nodes={[scratchNode]} activeFilePath={null} onFileSelect={noop} onOpenFolder={noop} ops={ops} />,
    )
    await userEvent.click(screen.getByTitle('New folder'))
    await userEvent.type(screen.getByRole('textbox'), 'pkg{Enter}')
    expect(ops.onCreateFolder).toHaveBeenCalledExactlyOnceWith('', 'pkg')
  })

  it('cancels the top-level input with Escape', async () => {
    const ops = makeOps()
    render(
      <FileTree nodes={[scratchNode]} activeFilePath={null} onFileSelect={noop} onOpenFolder={noop} ops={ops} />,
    )
    await userEvent.click(screen.getByTitle('New file'))
    await userEvent.type(screen.getByRole('textbox'), '{Escape}')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(ops.onCreateFile).not.toHaveBeenCalled()
  })

  it('still creates inside the single top-level folder when no file is active', async () => {
    const ops = makeOps()
    render(
      <FileTree nodes={[projNode]} activeFilePath={null} onFileSelect={noop} onOpenFolder={noop} ops={ops} />,
    )
    await userEvent.click(screen.getAllByTitle('New file')[0])
    await userEvent.type(screen.getByRole('textbox'), 'a.py{Enter}')
    expect(ops.onCreateFile).toHaveBeenCalledExactlyOnceWith('proj', 'a.py')
  })
})

