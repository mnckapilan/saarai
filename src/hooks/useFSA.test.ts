import {
  fsaSupported,
  readDirectory,
  deleteFromDirectory,
  writeToDirectory,
} from './useFSA'

describe('fsaSupported', () => {
  it('returns true when showDirectoryPicker is available', () => {
    const orig = (window as unknown as Record<string, unknown>).showDirectoryPicker
    ;(window as unknown as Record<string, unknown>).showDirectoryPicker = vi.fn()
    expect(fsaSupported()).toBe(true)
    if (orig !== undefined) {
      ;(window as unknown as Record<string, unknown>).showDirectoryPicker = orig
    } else {
      delete (window as unknown as Record<string, unknown>).showDirectoryPicker
    }
  })

  it('returns false when showDirectoryPicker is not available', () => {
    const orig = (window as unknown as Record<string, unknown>).showDirectoryPicker
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker
    expect(fsaSupported()).toBe(false)
    if (orig !== undefined) {
      ;(window as unknown as Record<string, unknown>).showDirectoryPicker = orig
    }
  })
})

describe('readDirectory', () => {
  it('returns file content mapped by prefixed path', async () => {
    const mockFile = { text: vi.fn().mockResolvedValue('print("hello")') }
    const mockFileHandle = { kind: 'file' as const, getFile: vi.fn().mockResolvedValue(mockFile) }
    const mockDirHandle = {
      name: 'project',
      entries: vi.fn().mockImplementation(async function* () {
        yield ['main.py', mockFileHandle]
      }),
    } as unknown as FileSystemDirectoryHandle

    const result = await readDirectory(mockDirHandle)
    expect(result.get('project/main.py')).toBe('print("hello")')
  })

  it('skips dot-prefixed hidden entries', async () => {
    const mockFile = { text: vi.fn().mockResolvedValue('secret') }
    const mockHiddenHandle = { kind: 'file' as const, getFile: vi.fn().mockResolvedValue(mockFile) }
    const mockDirHandle = {
      name: 'project',
      entries: vi.fn().mockImplementation(async function* () {
        yield ['.env', mockHiddenHandle]
      }),
    } as unknown as FileSystemDirectoryHandle

    const result = await readDirectory(mockDirHandle)
    expect(result.size).toBe(0)
  })

  it('reads files in nested subdirectories', async () => {
    const mockFile = { text: vi.fn().mockResolvedValue('nested content') }
    const mockFileHandle = { kind: 'file' as const, getFile: vi.fn().mockResolvedValue(mockFile) }
    const mockSubDirHandle = {
      kind: 'directory' as const,
      name: 'src',
      entries: vi.fn().mockImplementation(async function* () {
        yield ['utils.py', mockFileHandle]
      }),
    }
    const mockDirHandle = {
      name: 'project',
      entries: vi.fn().mockImplementation(async function* () {
        yield ['src', mockSubDirHandle]
      }),
    } as unknown as FileSystemDirectoryHandle

    const result = await readDirectory(mockDirHandle)
    expect(result.get('project/src/utils.py')).toBe('nested content')
  })

  it('silently skips unreadable files', async () => {
    const mockFileHandle = {
      kind: 'file' as const,
      getFile: vi.fn().mockRejectedValue(new Error('Permission denied')),
    }
    const mockDirHandle = {
      name: 'project',
      entries: vi.fn().mockImplementation(async function* () {
        yield ['secret.bin', mockFileHandle]
      }),
    } as unknown as FileSystemDirectoryHandle

    const result = await readDirectory(mockDirHandle)
    expect(result.size).toBe(0)
  })
})

describe('deleteFromDirectory', () => {
  it('calls removeEntry with recursive: true on the target file', async () => {
    const mockRemoveEntry = vi.fn().mockResolvedValue(undefined)
    const mockDirHandle = {
      getDirectoryHandle: vi.fn(),
      removeEntry: mockRemoveEntry,
    } as unknown as FileSystemDirectoryHandle

    await deleteFromDirectory(mockDirHandle, 'main.py')
    expect(mockRemoveEntry).toHaveBeenCalledWith('main.py', { recursive: true })
  })

  it('navigates into subdirectories before deleting', async () => {
    const mockInnerRemove = vi.fn().mockResolvedValue(undefined)
    const mockSubDir = {
      getDirectoryHandle: vi.fn(),
      removeEntry: mockInnerRemove,
    }
    const mockDirHandle = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mockSubDir),
      removeEntry: vi.fn(),
    } as unknown as FileSystemDirectoryHandle

    await deleteFromDirectory(mockDirHandle, 'src/utils.py')
    expect((mockDirHandle as unknown as { getDirectoryHandle: ReturnType<typeof vi.fn> }).getDirectoryHandle).toHaveBeenCalledWith('src')
    expect(mockInnerRemove).toHaveBeenCalledWith('utils.py', { recursive: true })
  })
})

describe('writeToDirectory', () => {
  it('writes content to the specified file', async () => {
    const mockWritable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }
    const mockFileHandle = {
      createWritable: vi.fn().mockResolvedValue(mockWritable),
    }
    const mockDirHandle = {
      getDirectoryHandle: vi.fn(),
      getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
    } as unknown as FileSystemDirectoryHandle

    await writeToDirectory(mockDirHandle, 'main.py', 'print("hello")')
    expect(mockWritable.write).toHaveBeenCalledWith('print("hello")')
    expect(mockWritable.close).toHaveBeenCalled()
  })

  it('creates intermediate directories for nested paths', async () => {
    const mockWritable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    }
    const mockFileHandle = { createWritable: vi.fn().mockResolvedValue(mockWritable) }
    const mockSubDir = {
      getDirectoryHandle: vi.fn(),
      getFileHandle: vi.fn().mockResolvedValue(mockFileHandle),
    }
    const mockDirHandle = {
      getDirectoryHandle: vi.fn().mockResolvedValue(mockSubDir),
      getFileHandle: vi.fn(),
    } as unknown as FileSystemDirectoryHandle

    await writeToDirectory(mockDirHandle, 'src/utils.py', 'pass')
    expect((mockDirHandle as unknown as { getDirectoryHandle: ReturnType<typeof vi.fn> }).getDirectoryHandle).toHaveBeenCalledWith('src', { create: true })
    expect(mockSubDir.getFileHandle).toHaveBeenCalledWith('utils.py', { create: true })
  })
})
