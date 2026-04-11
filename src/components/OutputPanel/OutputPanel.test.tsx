import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OutputPanel } from './OutputPanel'
import type { OutputLine } from '../../types'

function makeLines(overrides: Partial<OutputLine>[]): OutputLine[] {
  return overrides.map((o, i) => ({
    type: 'stdout',
    text: `line ${i}`,
    timestamp: 1000 + i,
    ...o,
  }))
}

describe('OutputPanel', () => {
  it('shows placeholder text when output is empty', () => {
    render(<OutputPanel output={[]} onClear={vi.fn()} />)
    expect(screen.getByText(/Run your code to see output here/)).toBeInTheDocument()
  })

  it('does not show Clear button when output is empty', () => {
    render(<OutputPanel output={[]} onClear={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Clear/i })).not.toBeInTheDocument()
  })

  it('shows Clear button when output is non-empty', () => {
    render(<OutputPanel output={makeLines([{ text: 'hello' }])} onClear={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Clear/i })).toBeInTheDocument()
  })

  it('calls onClear when Clear button is clicked', async () => {
    const onClear = vi.fn()
    render(<OutputPanel output={makeLines([{ text: 'hello' }])} onClear={onClear} />)
    await userEvent.click(screen.getByRole('button', { name: /Clear/i }))
    expect(onClear).toHaveBeenCalledOnce()
  })

  it('renders stdout lines', () => {
    render(<OutputPanel output={makeLines([{ type: 'stdout', text: 'hello world' }])} onClear={vi.fn()} />)
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('renders stderr lines', () => {
    render(<OutputPanel output={makeLines([{ type: 'stderr', text: 'NameError: x' }])} onClear={vi.fn()} />)
    expect(screen.getByText('NameError: x')).toBeInTheDocument()
  })

  it('renders info lines', () => {
    render(<OutputPanel output={makeLines([{ type: 'info', text: 'Mounted 3 files' }])} onClear={vi.fn()} />)
    expect(screen.getByText('Mounted 3 files')).toBeInTheDocument()
  })

  it('renders multiple output lines', () => {
    const output = makeLines([{ text: 'first' }, { text: 'second' }, { text: 'third' }])
    render(<OutputPanel output={output} onClear={vi.fn()} />)
    expect(screen.getByText('first')).toBeInTheDocument()
    expect(screen.getByText('second')).toBeInTheDocument()
    expect(screen.getByText('third')).toBeInTheDocument()
  })
})
