// Vitest test setup
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock fetch globally
global.fetch = vi.fn()

// Mock AudioContext
class MockAudioContext {
  sampleRate = 16000
  createMediaStreamSource = vi.fn(() => ({
    connect: vi.fn(),
  }))
  createScriptProcessor = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    onaudioprocess: null,
  }))
  close = vi.fn()
}

// Mock navigator.mediaDevices
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: vi.fn(() => Promise.resolve(new MediaStream())),
    },
  },
  configurable: true,
})

// Mock TextDecoder/TextEncoder
global.TextDecoder = class TextDecoder {
  decode(buffer: Uint8Array, options?: { stream?: boolean }): string {
    return new TextDecoder().decode(buffer, options)
  }
}

// Mock RequestAnimationFrame
global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  return setTimeout(() => callback(Date.now()), 16) as unknown as number
})

global.cancelAnimationFrame = vi.fn((id: number) => {
  clearTimeout(id)
})

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}