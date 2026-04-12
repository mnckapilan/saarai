import { render, act } from '@testing-library/react'
import { Editor } from './Editor'

// ── Monaco mock ───────────────────────────────────────────────────────────────
// Capture event listeners registered by the Editor so tests can trigger them.

type CursorPositionEvent = { position: { lineNumber: number; column: number } }
type SelectionEvent = { selection: { isEmpty: () => boolean } }

let capturedCursorPositionListener: ((e: CursorPositionEvent) => void) | null = null
let capturedSelectionListener: ((e: SelectionEvent) => void) | null = null

const mockEditor = {
  addCommand: vi.fn(),
  onDidChangeCursorPosition: vi.fn((cb: (e: CursorPositionEvent) => void) => {
    capturedCursorPositionListener = cb
    return { dispose: vi.fn() }
  }),
  onDidChangeCursorSelection: vi.fn((cb: (e: SelectionEvent) => void) => {
    capturedSelectionListener = cb
    return { dispose: vi.fn() }
  }),
  setModel: vi.fn(),
  saveViewState: vi.fn(() => null),
  restoreViewState: vi.fn(),
  getSelection: vi.fn(() => null),
}

const mockMonaco = {
  KeyMod: { CtrlCmd: 2048 },
  KeyCode: { Enter: 3 },
  Uri: { parse: vi.fn(() => 'mock-uri') },
  editor: {
    createModel: vi.fn(() => ({
      getValue: vi.fn(() => ''),
      onDidChangeContent: vi.fn(() => ({ dispose: vi.fn() })),
    })),
  },
}

vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ onMount }: { onMount?: (e: unknown, m: unknown) => void }) => {
    // Simulate Monaco calling onMount after mounting
    onMount?.(mockEditor, mockMonaco)
    return null
  }),
  loader: { config: vi.fn() },
}))

function renderEditor(overrides: Partial<Parameters<typeof Editor>[0]> = {}) {
  const props = {
    value: '',
    onChange: vi.fn(),
    onRun: vi.fn(),
    fontFamily: 'monospace',
    fontLigatures: false,
    fontSize: 14,
    ...overrides,
  }
  return { ...render(<Editor {...props} />), props }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Editor — onCursorPositionChange', () => {
  beforeEach(() => {
    capturedCursorPositionListener = null
    capturedSelectionListener = null
    vi.clearAllMocks()
  })

  it('calls onCursorPositionChange with line and column when the cursor moves', () => {
    const onCursorPositionChange = vi.fn()
    renderEditor({ onCursorPositionChange })

    act(() => {
      capturedCursorPositionListener?.({ position: { lineNumber: 5, column: 12 } })
    })

    expect(onCursorPositionChange).toHaveBeenCalledWith(5, 12)
  })

  it('passes the exact line and column from the event', () => {
    const onCursorPositionChange = vi.fn()
    renderEditor({ onCursorPositionChange })

    act(() => {
      capturedCursorPositionListener?.({ position: { lineNumber: 1, column: 1 } })
      capturedCursorPositionListener?.({ position: { lineNumber: 42, column: 7 } })
    })

    expect(onCursorPositionChange).toHaveBeenNthCalledWith(1, 1, 1)
    expect(onCursorPositionChange).toHaveBeenNthCalledWith(2, 42, 7)
  })

  it('does not throw when onCursorPositionChange is not provided', () => {
    renderEditor()
    expect(() => {
      act(() => {
        capturedCursorPositionListener?.({ position: { lineNumber: 1, column: 1 } })
      })
    }).not.toThrow()
  })
})

describe('Editor — onSelectionChange', () => {
  beforeEach(() => {
    capturedSelectionListener = null
    vi.clearAllMocks()
  })

  it('calls onSelectionChange(true) when selection is non-empty', () => {
    const onSelectionChange = vi.fn()
    renderEditor({ onSelectionChange })

    act(() => {
      capturedSelectionListener?.({ selection: { isEmpty: () => false } })
    })

    expect(onSelectionChange).toHaveBeenCalledWith(true)
  })

  it('calls onSelectionChange(false) when selection is empty', () => {
    const onSelectionChange = vi.fn()
    renderEditor({ onSelectionChange })

    act(() => {
      capturedSelectionListener?.({ selection: { isEmpty: () => true } })
    })

    expect(onSelectionChange).toHaveBeenCalledWith(false)
  })
})
