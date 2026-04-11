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
  it('is enabled when status is ready', () => {
    renderToolbar({ status: 'ready' })
    expect(screen.getByRole('button', { name: /Run code/i })).not.toBeDisabled()
  })

  it('is disabled when status is loading', () => {
    renderToolbar({ status: 'loading' })
    expect(screen.getByRole('button', { name: /Run code/i })).toBeDisabled()
  })

  it('is disabled when status is running', () => {
    renderToolbar({ status: 'running' })
    expect(screen.getByRole('button', { name: /Run code/i })).toBeDisabled()
  })

  it('is disabled when status is error', () => {
    renderToolbar({ status: 'error' })
    expect(screen.getByRole('button', { name: /Run code/i })).toBeDisabled()
  })

  it('calls onRun when clicked', async () => {
    const onRun = vi.fn()
    renderToolbar({ onRun })
    await userEvent.click(screen.getByRole('button', { name: /Run code/i }))
    expect(onRun).toHaveBeenCalledOnce()
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
  it('shows "Unsaved changes" when saveStatus is unsaved', () => {
    renderToolbar({ saveStatus: 'unsaved' })
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument()
  })

  it('shows "Autosaved" when saveStatus is autosaved', () => {
    renderToolbar({ saveStatus: 'autosaved' })
    expect(screen.getByText(/Autosaved/)).toBeInTheDocument()
  })

  it('shows neither indicator when saveStatus is null', () => {
    renderToolbar({ saveStatus: null })
    expect(screen.queryByText(/Unsaved changes/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Autosaved/)).not.toBeInTheDocument()
  })
})

describe('Toolbar — autosave toggle', () => {
  it('is absent when onAutosaveToggle is not provided', () => {
    renderToolbar()
    expect(screen.queryByRole('button', { name: /autosave/i })).not.toBeInTheDocument()
  })

  it('shows Enable autosave label when autosave is off', () => {
    renderToolbar({ onAutosaveToggle: vi.fn(), autosaveEnabled: false })
    expect(screen.getByRole('button', { name: /Enable autosave/i })).toBeInTheDocument()
  })

  it('shows Disable autosave label when autosave is on', () => {
    renderToolbar({ onAutosaveToggle: vi.fn(), autosaveEnabled: true })
    expect(screen.getByRole('button', { name: /Disable autosave/i })).toBeInTheDocument()
  })
})
