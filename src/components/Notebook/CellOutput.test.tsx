import { render, screen } from '@testing-library/react'
import { CellOutput } from './CellOutput'
import type { OutputLine } from '../../types'

function makeOutputLine(type: OutputLine['type'], text: string): OutputLine {
  return { type, text, timestamp: Date.now() }
}

describe('CellOutput', () => {
  it('renders nothing when outputs is empty array', () => {
    const { container } = render(<CellOutput outputs={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders stdout text', () => {
    render(<CellOutput outputs={[makeOutputLine('stdout', 'hello stdout')]} />)
    expect(screen.getByText('hello stdout')).toBeInTheDocument()
  })

  it('renders stderr text and has error styling', () => {
    render(<CellOutput outputs={[makeOutputLine('stderr', 'NameError: x')]} />)
    const el = screen.getByText('NameError: x')
    expect(el).toBeInTheDocument()
    // The element should have a class that includes 'stderr' (CSS module hashes the name)
    expect(el.className).toMatch(/stderr/)
  })

  it('renders multiple lines in order', () => {
    const outputs = [
      makeOutputLine('stdout', 'first line'),
      makeOutputLine('stderr', 'second line'),
      makeOutputLine('info', 'third line'),
    ]
    render(<CellOutput outputs={outputs} />)
    expect(screen.getByText('first line')).toBeInTheDocument()
    expect(screen.getByText('second line')).toBeInTheDocument()
    expect(screen.getByText('third line')).toBeInTheDocument()

    // Check order via DOM position
    const lines = screen.getByRole('log').querySelectorAll('div')
    expect(lines[0].textContent).toBe('first line')
    expect(lines[1].textContent).toBe('second line')
    expect(lines[2].textContent).toBe('third line')
  })

  it('renders info type', () => {
    render(<CellOutput outputs={[makeOutputLine('info', 'Mounted 5 files')]} />)
    const el = screen.getByText('Mounted 5 files')
    expect(el).toBeInTheDocument()
    expect(el.className).toMatch(/info/)
  })

  it('renders all three types together', () => {
    const outputs = [
      makeOutputLine('stdout', 'out text'),
      makeOutputLine('stderr', 'err text'),
      makeOutputLine('info', 'info text'),
    ]
    render(<CellOutput outputs={outputs} />)
    expect(screen.getByText('out text')).toBeInTheDocument()
    expect(screen.getByText('err text')).toBeInTheDocument()
    expect(screen.getByText('info text')).toBeInTheDocument()
    expect(screen.getByText('out text').className).toMatch(/stdout/)
    expect(screen.getByText('err text').className).toMatch(/stderr/)
    expect(screen.getByText('info text').className).toMatch(/info/)
  })
})
