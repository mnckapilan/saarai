import '@testing-library/jest-dom'

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// jsdom's localStorage may be incomplete in some environments; provide a working stub
const makeLocalStorage = () => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value) },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  }
}

Object.defineProperty(window, 'localStorage', {
  value: makeLocalStorage(),
  writable: true,
})
