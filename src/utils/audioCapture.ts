/**
 * Audio capture utility: microphone → PCM 16kHz 16-bit mono
 *
 * Usage:
 *   const capture = new AudioCapture({
 *     onChunk: (pcmFrame) => ws.send(pcmFrame),
 *     onError: (err) => console.error(err),
 *   })
 *   await capture.start()
 *   // ... later
 *   capture.stop()
 */

type AudioCaptureCallbacks = {
  onChunk: (pcm: ArrayBuffer) => void
  onError: (err: string) => void
}

export class AudioCapture {
  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private callbacks: AudioCaptureCallbacks
  private _running = false

  constructor(callbacks: AudioCaptureCallbacks) {
    this.callbacks = callbacks
  }

  get running() {
    return this._running
  }

  async start(): Promise<void> {
    if (this._running) return

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      this.callbacks.onError('Microphone access denied')
      return
    }

    this.ctx = new AudioContext({ sampleRate: 16000 })
    this.source = this.ctx.createMediaStreamSource(this.stream)

    // ScriptProcessorNode (deprecated but simplest cross-browser solution)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1)
    this.source.connect(this.processor)
    this.processor.connect(this.ctx.destination)

    this.processor.onaudioprocess = (e) => {
      if (!this._running) return
      const input = e.inputBuffer.getChannelData(0)

      // Float32 [-1,1] → Int16 PCM
      const pcm = new Int16Array(input.length)
      for (let i = 0; i < input.length; i++) {
        const s = Math.max(-1, Math.min(1, input[i]))
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
      }
      this.callbacks.onChunk(pcm.buffer)
    }

    this._running = true
  }

  stop(): void {
    this._running = false
    this.processor?.disconnect()
    this.source?.disconnect()
    this.ctx?.close()
    this.stream?.getTracks().forEach((t) => t.stop())
    this.processor = null
    this.source = null
    this.ctx = null
    this.stream = null
  }
}
