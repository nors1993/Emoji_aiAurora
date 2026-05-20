import type { Settings, Emotion } from '../types'
import { emotionToInstruct } from '../types'

export type TTSChunk = {
  index: number
  text: string
  audio: Blob
  sampleRate: number
}

export class TTSClient {
  private controller: AbortController | null = null
  private settings: Settings
  private _speaking = false

  onChunk: ((chunk: TTSChunk) => void) | null = null
  onDone: (() => void) | null = null
  onError: ((err: string) => void) | null = null

  constructor(settings: Settings) {
    this.settings = settings
  }

  get speaking() {
    return this._speaking
  }

  async speak(text: string, emotion?: Emotion): Promise<void> {
    if (this._speaking) this.stop()
    this._speaking = true

    this.controller = new AbortController()

    const base = this.settings.ttsUrl.replace(/\/+$/, '')
    const url = `${base}/v1/audio/speech`

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.settings.ttsApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          voice: this.settings.ttsSpeaker || 'Vivian',
          language: this.settings.ttsLanguage || 'Chinese',
          stream: true,
          response_format: 'wav',
          instruct: emotion ? emotionToInstruct(emotion) : undefined,
        }),
        signal: this.controller.signal,
      })

      if (!resp.ok) {
        this.onError?.(`TTS server error: ${resp.status}`)
        this._speaking = false
        return
      }

      const reader = resp.body?.getReader()
      if (!reader) {
        this.onError?.('No response body')
        this._speaking = false
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue

          const payload = trimmed.slice(6)
          if (payload === '[DONE]') continue

          try {
            const data = JSON.parse(payload)
            if (data.index === -1) continue

            const audioBytes = Uint8Array.from(atob(data.audio), (c) =>
              c.charCodeAt(0),
            )
            const blob = new Blob([audioBytes], { type: 'audio/wav' })

            this.onChunk?.({
              index: data.index,
              text: data.text,
              audio: blob,
              sampleRate: data.sample_rate,
            })
          } catch {
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      this.onError?.(err instanceof Error ? err.message : String(err))
    } finally {
      this._speaking = false
      this.onDone?.()
    }
  }

  stop(): void {
    this.controller?.abort()
    this._speaking = false
  }
}
