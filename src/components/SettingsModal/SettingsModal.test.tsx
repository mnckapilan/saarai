import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsModal } from './SettingsModal'

function renderModal(overrides: Partial<Parameters<typeof SettingsModal>[0]> = {}) {
  const props = {
    onClose: vi.fn(),
    theme: 'dark' as const,
    onThemeToggle: vi.fn(),
    bracketColorization: true,
    onBracketColorizationToggle: vi.fn(),
    ...overrides,
  }
  return { ...render(<SettingsModal {...props} />), props }
}

// ── Content ────────────────────────────────────────────────────────────────────

describe('SettingsModal — content', () => {
  it('renders the Settings heading', () => {
    renderModal()
    expect(screen.getByRole('heading', { name: /Settings/i })).toBeInTheDocument()
  })

  it('renders Light mode row with description', () => {
    renderModal()
    expect(screen.getByText('Light mode')).toBeInTheDocument()
    expect(screen.getByText('Switch to a light colour theme')).toBeInTheDocument()
  })

  it('renders Bracket colors row with description', () => {
    renderModal()
    expect(screen.getByText('Bracket colors')).toBeInTheDocument()
    expect(screen.getByText('Colorize matching brackets in the editor')).toBeInTheDocument()
  })

  it('does not render Autosave row when onAutosaveToggle is not provided', () => {
    renderModal()
    expect(screen.queryByText('Autosave')).not.toBeInTheDocument()
  })

  it('renders Autosave row with description when onAutosaveToggle is provided', () => {
    renderModal({ onAutosaveToggle: vi.fn(), autosaveEnabled: true })
    expect(screen.getByText('Autosave')).toBeInTheDocument()
    expect(screen.getByText('Save changes automatically every 5 seconds')).toBeInTheDocument()
  })
})

// ── Switch states ──────────────────────────────────────────────────────────────

describe('SettingsModal — switch states', () => {
  it('Light mode switch is off when theme is dark', () => {
    renderModal({ theme: 'dark' })
    expect(screen.getByRole('switch', { name: /Light mode/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('Light mode switch is on when theme is light', () => {
    renderModal({ theme: 'light' })
    expect(screen.getByRole('switch', { name: /Light mode/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('Bracket colors switch reflects true state', () => {
    renderModal({ bracketColorization: true })
    expect(screen.getByRole('switch', { name: /Bracket colors/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('Bracket colors switch reflects false state', () => {
    renderModal({ bracketColorization: false })
    expect(screen.getByRole('switch', { name: /Bracket colors/i })).toHaveAttribute('aria-checked', 'false')
  })

  it('Autosave switch reflects enabled state', () => {
    renderModal({ onAutosaveToggle: vi.fn(), autosaveEnabled: true })
    expect(screen.getByRole('switch', { name: /Autosave/i })).toHaveAttribute('aria-checked', 'true')
  })

  it('Autosave switch reflects disabled state', () => {
    renderModal({ onAutosaveToggle: vi.fn(), autosaveEnabled: false })
    expect(screen.getByRole('switch', { name: /Autosave/i })).toHaveAttribute('aria-checked', 'false')
  })
})

// ── Interactions ───────────────────────────────────────────────────────────────

describe('SettingsModal — interactions', () => {
  it('calls onThemeToggle when Light mode switch is clicked', async () => {
    const onThemeToggle = vi.fn()
    renderModal({ onThemeToggle })
    await userEvent.click(screen.getByRole('switch', { name: /Light mode/i }))
    expect(onThemeToggle).toHaveBeenCalledOnce()
  })

  it('calls onBracketColorizationToggle when Bracket colors switch is clicked', async () => {
    const onBracketColorizationToggle = vi.fn()
    renderModal({ onBracketColorizationToggle })
    await userEvent.click(screen.getByRole('switch', { name: /Bracket colors/i }))
    expect(onBracketColorizationToggle).toHaveBeenCalledOnce()
  })

  it('calls onAutosaveToggle when Autosave switch is clicked', async () => {
    const onAutosaveToggle = vi.fn()
    renderModal({ onAutosaveToggle })
    await userEvent.click(screen.getByRole('switch', { name: /Autosave/i }))
    expect(onAutosaveToggle).toHaveBeenCalledOnce()
  })
})
