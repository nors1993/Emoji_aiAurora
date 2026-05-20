/**
 * Fun-ASR WebSocket streaming client.
 *
 * Usage:
 *   const asr = new ASRClient('ws://localhost:8001', 'sk-funasr-demo')
 *   asr.onTranscription = (text) => console.log('recognised:', text)
 *   asr.connect()
 *   asr.sendAudio(pcmChunk)
 *   asr.close()
 */

export class ASRClient {
  private ws: WebSocket | null = null
  private url: string

  onTranscription: ((text: string) => void) | null = null
  onSpeechStart: (() => void) | null = null
  onError: ((err: string) => void) | null = null
  onOpen: (() => void) | null = null
  onClose: (() => void) | null = null

  constructor(url: string, apiKey: string) {
    const base = url.replace(/\/+$/, '')
    this.url = `${base}/v1/audio/transcriptions/stream?api_key=${apiKey}`
  }

  get connected() {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  connect(): void {
    if (this.ws) this.close()

    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      this.onOpen?.()
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'final') {
          this.onTranscription?.(msg.text)
        } else if (msg.type === 'speech_started') {
          this.onSpeechStart?.()
        } else if (msg.type === 'error') {
          this.onError?.(msg.message)
        }
      } catch {
        this.onError?.('Failed to parse ASR message')
      }
    }

    this.ws.onerror = () => {
      this.onError?.('WebSocket connection error')
    }

    this.ws.onclose = () => {
      this.ws = null
      this.onClose?.()
    }
  }

  sendAudio(pcm: ArrayBuffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(pcm)
    }
  }

  close(): void {
    this.ws?.close()
    this.ws = null
  }
}
