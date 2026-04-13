import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CodeCell } from './CodeCell'
import { HydratedCell } from '../../types'

// ── Monaco mock ───────────────────────────────────────────────────────────────
// Capture onMount callback and addCommand calls so tests can inspect them.

type AddCommandCall = { keybinding: number; handler: () => void }
let capturedAddCommands: AddCommandCall[] = []

const mockEditorInstance = {
  focus: vi.fn(),
  onDidContentSizeChange: vi.fn((cb: () => void) => {
    cb()
    return { dispose: vi.fn() }
  }),
  getContentHeight: vi.fn(() => 100),
  addCommand: vi.fn((keybinding: number, handler: () => void) => {
    capturedAddCommands.push({ keybinding, handler })
  }),
}

const mockMonaco = {
  KeyMod: {
    CtrlCmd: 2048,
    Shift: 1024,
  },
  KeyCode: {
    Enter: 3,
  },
}

vi.mock('monaco-editor', () => ({}))
vi.mock('monaco-editor/esm/vs/editor/editor.worker?worker', () => ({
  default: class MockWorker {},
}))

vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(
    ({ onMount }: { onMount?: (editor: unknown, monaco: unknown) => void }) => {
      onMount?.(mockEditorInstance, mockMonaco)
      return null
    },
  ),
  loader: { config: vi.fn() },
}))

// ── Default props ─────────────────────────────────────────────────────────────

const mockOnRun = vi.fn()
const mockOnRunAndAdvance = vi.fn()
const mockRegisterFocus = vi.fn()
const mockOnUpdateSource = vi.fn()

const defaultCell: HydratedCell = {
  id: 'test-cell-1',
  cell_type: 'code',
  source: ['print("hello")'],
  metadata: {},
  outputs: [],
  executionCount: null,
  isRunning: false,
}

function renderCodeCell(overrides: Record<string, unknown> = {}) {
  return render(
    <CodeCell
      cell={defaultCell}
      onUpdateSource={mockOnUpdateSource}
      onRun={mockOnRun}
      onRunAndAdvance={mockOnRunAndAdvance}
      registerFocus={mockRegisterFocus}
      monacoTheme="vs-dark"
      fontFamily="monospace"
      fontSize={14}
      {...overrides}
    />,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedAddCommands = []
  vi.clearAllMocks()
  // Re-attach addCommand capture after clearAllMocks resets the spy
  mockEditorInstance.addCommand.mockImplementation((keybinding: number, handler: () => void) => {
    capturedAddCommands.push({ keybinding, handler })
  })
  mockEditorInstance.getContentHeight.mockReturnValue(100)
  mockEditorInstance.onDidContentSizeChange.mockImplementation((cb: () => void) => {
    cb()
    return { dispose: vi.fn() }
  })
})

describe('CodeCell', () => {
  it('renders run button', () => {
    renderCodeCell()
    expect(screen.getByRole('button', { name: 'Run cell' })).toBeInTheDocument()
  })

  it('run button calls onRun', async () => {
    const user = userEvent.setup()
    renderCodeCell()
    await user.click(screen.getByRole('button', { name: 'Run cell' }))
    expect(mockOnRun).toHaveBeenCalledOnce()
  })

  it('shows spinner when isRunning', () => {
    const runningCell: HydratedCell = { ...defaultCell, isRunning: true }
    renderCodeCell({ cell: runningCell })
    expect(screen.queryByRole('button', { name: 'Run cell' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Running…' })).toBeInTheDocument()
  })

  it('shows execution count', () => {
    const cell: HydratedCell = { ...defaultCell, executionCount: 3 }
    renderCodeCell({ cell })
    expect(screen.getByText('[3]:')).toBeInTheDocument()
  })

  it('shows empty execution count placeholder', () => {
    renderCodeCell()
    expect(screen.getByText('[ ]:')).toBeInTheDocument()
  })

  it('onMount registers focus', () => {
    renderCodeCell()
    // registerFocus should have been called at least once (React StrictMode may
    // invoke effects twice). The registered function should call focus().
    expect(mockRegisterFocus).toHaveBeenCalled()
    const lastCall = mockRegisterFocus.mock.calls[mockRegisterFocus.mock.calls.length - 1]
    const focusFn = lastCall[0] as () => void
    focusFn()
    expect(mockEditorInstance.focus).toHaveBeenCalled()
  })

  it('Cmd+Enter calls onRun, not onRunAndAdvance', () => {
    renderCodeCell()
    // CtrlCmd | Enter = 2048 | 3 = 2051
    const cmdEnterBinding = mockMonaco.KeyMod.CtrlCmd | mockMonaco.KeyCode.Enter
    const cmdEnterCmd = capturedAddCommands.find((c) => c.keybinding === cmdEnterBinding)
    expect(cmdEnterCmd).toBeDefined()
    cmdEnterCmd!.handler()
    expect(mockOnRun).toHaveBeenCalledOnce()
    expect(mockOnRunAndAdvance).not.toHaveBeenCalled()
  })

  it('Shift+Enter calls onRunAndAdvance, not onRun', () => {
    renderCodeCell()
    // Shift | Enter = 1024 | 3 = 1027
    const shiftEnterBinding = mockMonaco.KeyMod.Shift | mockMonaco.KeyCode.Enter
    const shiftEnterCmd = capturedAddCommands.find((c) => c.keybinding === shiftEnterBinding)
    expect(shiftEnterCmd).toBeDefined()
    shiftEnterCmd!.handler()
    expect(mockOnRunAndAdvance).toHaveBeenCalledOnce()
    expect(mockOnRun).not.toHaveBeenCalled()
  })
})
