// Tests for formatPythonError. The function is not exported, so we test it
// indirectly via a re-implementation here that mirrors the logic exactly.
// This keeps the worker file free of test-only exports.

// Copied verbatim from pyodide.worker.ts — update both if the logic changes.
function formatPythonError(err: unknown): string {
  const raw = String(err)
  const text = raw.startsWith('PythonError: ') ? raw.slice(13) : raw

  const lines = text.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (/^\s+File ".*\/_pyodide\//.test(line)) {
      i++
      while (
        i < lines.length &&
        lines[i] !== '' &&
        !/^\s+File "/.test(lines[i]) &&
        !/^\w/.test(lines[i])
      ) {
        i++
      }
    } else {
      out.push(line)
      i++
    }
  }

  const cleaned = out.join('\n').replace(/File "\/project\//g, 'File "')
  const result = cleaned.replace(/^Traceback \(most recent call last\):\s*\n(?=\w)/, '')

  return result.trim()
}

describe('formatPythonError', () => {
  it('strips the PythonError: prefix', () => {
    const input = 'PythonError: NameError: name "x" is not defined'
    expect(formatPythonError(input)).toBe('NameError: name "x" is not defined')
  })

  it('leaves errors without the prefix unchanged', () => {
    const input = 'SomeOtherError: something went wrong'
    expect(formatPythonError(input)).toBe(input)
  })

  it('filters out internal _pyodide frames and their code lines', () => {
    const input = [
      'PythonError: Traceback (most recent call last):',
      '  File "/lib/python312.zip/_pyodide/_base.py", line 597, in eval_code_async',
      '    await CodeRunner(',
      '  File "<exec>", line 1, in <module>',
      '    1 / 0',
      'ZeroDivisionError: division by zero',
    ].join('\n')

    const result = formatPythonError(input)
    expect(result).not.toContain('_pyodide')
    expect(result).not.toContain('eval_code_async')
    expect(result).toContain('File "<exec>", line 1, in <module>')
    expect(result).toContain('ZeroDivisionError: division by zero')
  })

  it('preserves user frames when internal frames are interleaved', () => {
    const input = [
      'PythonError: Traceback (most recent call last):',
      '  File "/lib/python312.zip/_pyodide/_base.py", line 597, in eval_code_async',
      '    await CodeRunner(',
      '  File "<exec>", line 3, in <module>',
      '    foo()',
      '  File "<exec>", line 1, in foo',
      '    return 1 / 0',
      'ZeroDivisionError: division by zero',
    ].join('\n')

    const result = formatPythonError(input)
    expect(result).not.toContain('_pyodide')
    expect(result).toContain('line 3, in <module>')
    expect(result).toContain('line 1, in foo')
    expect(result).toContain('ZeroDivisionError: division by zero')
  })

  it('produces clean KeyboardInterrupt output from Stop button', () => {
    const input = [
      'PythonError: Traceback (most recent call last):',
      '  File "/lib/python312.zip/_pyodide/_base.py", line 597, in eval_code_async',
      '    await CodeRunner(',
      '  File "/lib/python312.zip/_pyodide/_base.py", line 411, in run_async',
      '    coroutine = eval(self.code, globals, locals)',
      '                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
      '  File "<exec>", line 1, in <module>',
      'KeyboardInterrupt',
    ].join('\n')

    const result = formatPythonError(input)
    expect(result).not.toContain('_pyodide')
    expect(result).toContain('KeyboardInterrupt')
  })

  it('removes orphaned traceback header when all frames are internal', () => {
    const input = [
      'PythonError: Traceback (most recent call last):',
      '  File "/lib/python312.zip/_pyodide/_base.py", line 411, in run_async',
      '    coroutine = eval(self.code, globals, locals)',
      'KeyboardInterrupt',
    ].join('\n')

    const result = formatPythonError(input)
    expect(result).not.toMatch(/^Traceback/)
    expect(result).toBe('KeyboardInterrupt')
  })

  it('strips /project/ MEMFS prefix from file paths', () => {
    const input = [
      'PythonError: Traceback (most recent call last):',
      '  File "/lib/python312.zip/_pyodide/_base.py", line 597, in eval_code_async',
      '    await CodeRunner(',
      '  File "/project/myproject/main.py", line 5, in <module>',
      '    foo()',
      '  File "/project/myproject/utils.py", line 2, in foo',
      '    raise ValueError("oops")',
      'ValueError: oops',
    ].join('\n')

    const result = formatPythonError(input)
    expect(result).toContain('File "myproject/main.py", line 5')
    expect(result).toContain('File "myproject/utils.py", line 2')
    expect(result).not.toContain('/project/')
  })

  it('handles non-Error values passed as err', () => {
    expect(formatPythonError('plain string error')).toBe('plain string error')
    expect(formatPythonError(42)).toBe('42')
  })
})
