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
    onOpenSettings: vi.fn(),
    onAbout: vi.fn(),
    ...overrides,
  }
  return { ...render(<Toolbar {...props} />), props }
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

describe('Toolbar — Save in File menu', () => {
  it('Save item is absent when onSave is not provided', async () => {
    renderToolbar()
    await userEvent.click(screen.getByRole('button', { name: /^File$/i }))
    expect(screen.queryByRole('menuitem', { name: /^Save$/i })).not.toBeInTheDocument()
  })

  it('Save item is present when onSave is provided', async () => {
    renderToolbar({ onSave: vi.fn() })
    await userEvent.click(screen.getByRole('button', { name: /^File$/i }))
    expect(screen.getByRole('menuitem', { name: /^Save$/i })).toBeInTheDocument()
  })

  it('Save item is disabled when canSave is false', async () => {
    renderToolbar({ onSave: vi.fn(), canSave: false })
    await userEvent.click(screen.getByRole('button', { name: /^File$/i }))
    expect(screen.getByRole('menuitem', { name: /^Save$/i })).toBeDisabled()
  })

  it('Save item is enabled when canSave is true', async () => {
    renderToolbar({ onSave: vi.fn(), canSave: true })
    await userEvent.click(screen.getByRole('button', { name: /^File$/i }))
    expect(screen.getByRole('menuitem', { name: /^Save$/i })).not.toBeDisabled()
  })
})

describe('Toolbar — settings button', () => {
  it('calls onOpenSettings when the settings button is clicked', async () => {
    const onOpenSettings = vi.fn()
    renderToolbar({ onOpenSettings })
    await userEvent.click(screen.getByRole('button', { name: /Settings/i }))
    expect(onOpenSettings).toHaveBeenCalledOnce()
  })
})
