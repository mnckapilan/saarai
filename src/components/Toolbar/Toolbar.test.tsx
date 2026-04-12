import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toolbar } from './Toolbar'
import { DEFAULT_FONT } from '../../constants/fonts'
import type { PyodideStatus } from '../../types'

function renderToolbar(overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const props = {
    status: 'ready' as PyodideStatus,
    onRun: vi.fn(),
    onImport: vi.fn(),
    onOpenFolder: vi.fn(),
    font: DEFAULT_FONT,
    onFontChange: vi.fn(),
    fontSize: 14,
    onFontSizeChange: vi.fn(),
    theme: 'dark' as const,
    onThemeToggle: vi.fn(),
    bracketColorization: true,
    onBracketColorizationToggle: vi.fn(),
    onAbout: vi.fn(),
    ...overrides,
  }
  return { ...render(<Toolbar {...props} />), props }
}

async function openSettings() {
  await userEvent.click(screen.getByRole('button', { name: /Settings/i }))
}

describe('Toolbar — runtime status', () => {
  it('shows Ready when status is ready', () => {
    renderToolbar({ status: 'ready' })
    expect(screen.getByText(/Ready/)).toBeInTheDocument()
  })

  it('shows Loading runtime when status is loading', () => {
    renderToolbar({ status: 'loading' })
    expect(screen.getByText(/Loading runtime/)).toBeInTheDocument()
  })

  it('shows Running when status is running', () => {
    renderToolbar({ status: 'running' })
    expect(screen.getByText(/Running/)).toBeInTheDocument()
  })

  it('shows Runtime error when status is error', () => {
    renderToolbar({ status: 'error' })
    expect(screen.getByText(/Runtime error/)).toBeInTheDocument()
  })
})

describe('Toolbar — Run button', () => {
  it('is disabled when no file is open', () => {
    renderToolbar({ status: 'ready', fileOpen: false })
    expect(screen.getByRole('button', { name: /Run code/i })).toBeDisabled()
  })

  it('is enabled when a file is open and status is ready', () => {
    renderToolbar({ status: 'ready', fileOpen: true })
    expect(screen.getByRole('button', { name: /Run code/i })).not.toBeDisabled()
  })

  it('is disabled when status is loading', () => {
    renderToolbar({ status: 'loading', fileOpen: true })
    expect(screen.getByRole('button', { name: /Run code/i })).toBeDisabled()
  })

  it('is disabled when status is running', () => {
    renderToolbar({ status: 'running', fileOpen: true })
    expect(screen.getByRole('button', { name: /Run code/i })).toBeDisabled()
  })

  it('is disabled when status is error', () => {
    renderToolbar({ status: 'error', fileOpen: true })
    expect(screen.getByRole('button', { name: /Run code/i })).toBeDisabled()
  })

  it('calls onRun when clicked', async () => {
    const onRun = vi.fn()
    renderToolbar({ onRun, fileOpen: true })
    await userEvent.click(screen.getByRole('button', { name: /Run code/i }))
    expect(onRun).toHaveBeenCalledOnce()
  })

  it('shows "Run selection" label when editor has a selection', () => {
    renderToolbar({ fileOpen: true, hasEditorSelection: true })
    expect(screen.getByRole('button', { name: /Run selection/i })).toBeInTheDocument()
  })

  it('shows "Run" label when there is no selection', () => {
    renderToolbar({ fileOpen: true, hasEditorSelection: false })
    expect(screen.getByRole('button', { name: /Run code/i })).toBeInTheDocument()
  })
})

describe('Toolbar — Save button', () => {
  it('is absent when onSave is not provided', () => {
    renderToolbar()
    expect(screen.queryByRole('button', { name: /Save file/i })).not.toBeInTheDocument()
  })

  it('is present when onSave is provided', () => {
    renderToolbar({ onSave: vi.fn() })
    expect(screen.getByRole('button', { name: /Save file/i })).toBeInTheDocument()
  })

  it('is disabled when canSave is false', () => {
    renderToolbar({ onSave: vi.fn(), canSave: false })
    expect(screen.getByRole('button', { name: /Save file/i })).toBeDisabled()
  })

  it('is enabled when canSave is true', () => {
    renderToolbar({ onSave: vi.fn(), canSave: true })
    expect(screen.getByRole('button', { name: /Save file/i })).not.toBeDisabled()
  })
})

describe('Toolbar — save status indicator', () => {
  it('shows ● Save on the button when there are unsaved changes', () => {
    renderToolbar({ onSave: vi.fn(), canSave: true })
    expect(screen.getByRole('button', { name: /Save file/i })).toHaveTextContent('● Save')
  })

  it('shows Saved ✓ on the button briefly after autosave', async () => {
    renderToolbar({ onSave: vi.fn(), saveStatus: 'autosaved' })
    expect(screen.getByRole('button', { name: /Save file/i })).toHaveTextContent('Saved ✓')
  })

  it('shows plain Save on the button when there are no unsaved changes', () => {
    renderToolbar({ onSave: vi.fn(), saveStatus: null })
    expect(screen.getByRole('button', { name: /Save file/i })).toHaveTextContent('Save')
  })
})

describe('Toolbar — settings popup', () => {
  it('is closed by default', () => {
    renderToolbar()
    expect(screen.queryByText('Light mode')).not.toBeInTheDocument()
  })

  it('opens on settings button click', async () => {
    renderToolbar()
    await openSettings()
    expect(screen.getByText('Light mode')).toBeInTheDocument()
    expect(screen.getByText('Bracket colors')).toBeInTheDocument()
  })

  it('autosave row is absent when onAutosaveToggle is not provided', async () => {
    renderToolbar()
    await openSettings()
    expect(screen.queryByText('Autosave')).not.toBeInTheDocument()
  })

  it('autosave row is present when onAutosaveToggle is provided', async () => {
    renderToolbar({ onSave: vi.fn(), onAutosaveToggle: vi.fn(), autosaveEnabled: true })
    await openSettings()
    expect(screen.getByText('Autosave')).toBeInTheDocument()
  })

  it('autosave switch reflects enabled state', async () => {
    renderToolbar({ onSave: vi.fn(), onAutosaveToggle: vi.fn(), autosaveEnabled: false })
    await openSettings()
    expect(screen.getByRole('switch', { name: /Autosave/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('bracket colors switch reflects state', async () => {
    renderToolbar({ bracketColorization: false })
    await openSettings()
    expect(screen.getByRole('switch', { name: /Bracket colors/i })).toHaveAttribute('aria-checked', 'false')
  })
})
