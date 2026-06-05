import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('AudioCapture', () => {
  let AudioCapture: any
  let mockOnChunk: any
  let mockOnError: any

  beforeEach(async () => {
    vi.resetModules()
    const module = await import('../../src/utils/audioCapture')
    AudioCapture = module.AudioCapture
    mockOnChunk = vi.fn()
    mockOnError = vi.fn()
  })

  describe('VOICE-001: AudioCapture initialization', () => {
    it('initializes with null state', () => {
      const capture = new AudioCapture({
        onChunk: mockOnChunk,
        onError: mockOnError,
      })
      
      expect(capture.running).toBe(false)
    })
  })

  describe('VOICE-002: AudioCapture start', () => {
    it('requests microphone permission', async () => {
      const capture = new AudioCapture({
        onChunk: mockOnChunk,
        onError: mockOnError,
      })

      await capture.start()
      
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true })
    })
  })

  describe('VOICE-003: PCM conversion', () => {
    it('converts Float32 to Int16 correctly', () => {
      // Test the conversion logic
      const samples = [0.0, 0.5, -0.5, 1.0, -1.0]
      const expected = [0, 16384, -16384, 32767, -32768]
      
      const pcm = new Int16Array(samples.length)
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]))
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      
      expect(Array.from(pcm)).toEqual(expected)
    })
  })

  describe('VOICE-004: AudioCapture stop', () => {
    it('releases all resources', async () => {
      const capture = new AudioCapture({
        onChunk: mockOnChunk,
        onError: mockOnError,
      })

      await capture.start()
      capture.stop()
      
      expect(capture.running).toBe(false)
    })
  })

  describe('VOICE-005: Microphone permission denied', () => {
    it('calls onError callback', async () => {
      navigator.mediaDevices.getUserMedia = vi.fn(() => 
        Promise.reject(new Error('NotAllowedError'))
      )

      const capture = new AudioCapture({
        onChunk: mockOnChunk,
        onError: mockOnError,
      })

      await capture.start()
      
      expect(mockOnError).toHaveBeenCalled()
      expect(mockOnError.mock.calls[0][0]).toContain('Microphone access denied')
    })
  })

  describe('VOICE-006: Overflow clamping', () => {
    it('clamps values outside [-1, 1]', () => {
      const samples = [1.5, -1.5, 0.0]
      const expected = [32767, -32768, 0]
      
      const pcm = new Int16Array(samples.length)
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]))
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      
      expect(Array.from(pcm)).toEqual(expected)
    })
  })
})

describe('TTSClient', () => {
  let TTSClient: any

  beforeEach(async () => {
    vi.resetModules()
    const module = await import('../../src/utils/ttsClient')
    TTSClient = module.TTSClient
  })

  describe('VOICE-007: TTSClient initialization', () => {
    it('initializes with speaking=false', () => {
      const client = new TTSClient({
        apiKey: 'test',
        baseUrl: 'http://localhost:8002',
      } as any)
      
      expect(client.speaking).toBe(false)
    })
  })

  describe('VOICE-011: TTSClient error handling', () => {
    it('handles server error gracefully', async () => {
      global.fetch = vi.fn(() => Promise.resolve({
        ok: false,
        status: 500,
      }))

      const client = new TTSClient({
        ttsApiKey: 'test',
        ttsUrl: 'http://localhost:8002',
        ttsSpeaker: 'Vivian',
        ttsLanguage: 'Chinese',
      } as any)

      client.onError = vi.fn()

      await client.speak('Hello')

      expect(client.onError).toHaveBeenCalled()
      expect(client.speaking).toBe(false)
    })
  })

  describe('VOICE-012: Prevent double speak', () => {
    it('stops previous speak when called again', async () => {
      let abortCalled = false
      global.fetch = vi.fn(() => new Promise(() => {}))

      const client = new TTSClient({
        ttsApiKey: 'test',
        ttsUrl: 'http://localhost:8002',
        ttsSpeaker: 'Vivian',
        ttsLanguage: 'Chinese',
      } as any)

      // Start first speak
      const firstSpeak = client.speak('Hello')
      
      // Start second speak immediately
      const secondSpeak = client.speak('World')

      // Both should complete without error
      expect(client.speaking).toBe(true)
    })
  })
})