import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChatStore, getSystemPrompt } from '../../stores/chatStore'
import { sendToLLM, checkOllamaConnection, parseEmotionFromResponse, analyzeEmotionWithLLM, analyzeEmotionFromContext, cleanTextForTTS } from '../../utils/llm'
import { webSearch, formatSearchResultsForLLM } from '../../utils/webSearch'
import { AudioCapture } from '../../utils/audioCapture'
import { TTSClient } from '../../utils/ttsClient'
import type { TTSChunk } from '../../utils/ttsClient'
import type { Emotion } from '../../types'

import './Chat.css'

let recognition: SpeechRecognition | null = null
let synthesis: SpeechSynthesis | null = null

if (typeof window !== 'undefined') {
  const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (SpeechRecognitionCtor) {
    recognition = new SpeechRecognitionCtor()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
  }
  synthesis = window.speechSynthesis
}

export default function Chat() {
  const {
    messages,
    addMessage,
    isLoading,
    setLoading,
    isSpeaking,
    setSpeaking,
    currentEmotion,
    setCurrentEmotion,
    settings,
    personality,
    clearMessages,
    stopIntroMode
  } = useChatStore()
  
  const [input, setInput] = useState('')
  const [inputLang] = useState('en-US')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [isListening, setIsListening] = useState(false)
  const [isWebSearchMode, setIsWebSearchMode] = useState(false)
  const [isMicActive, setIsMicActive] = useState(false)
  const [isSpeakerActive, setIsSpeakerActive] = useState(false)

  const audioCaptureRef = useRef<AudioCapture | null>(null)
  const ttsClientRef = useRef<TTSClient | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const pcmBufferRef = useRef<Int16Array[]>([])
  const speechTranscriptRef = useRef('')

  useEffect(() => {
    console.log('=== CHAT SETTINGS UPDATE ===')
    console.log('settings in Chat:', JSON.stringify(settings))
    console.log('modelName in Chat:', settings.modelName)
    console.log('apiProvider in Chat:', settings.apiProvider)
  }, [settings])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle voice toggle from Electron main process
  useEffect(() => {
    if (window.electron) {
      const unsubscribe = window.electron.onToggleVoice(() => {
        setIsMicActive((v) => !v)
      })
      return unsubscribe
    }
  }, [])

  // Cleanup custom services on unmount
  useEffect(() => {
    return () => {
      audioCaptureRef.current?.stop()
      ttsClientRef.current?.stop()
      audioCtxRef.current?.close().catch(e => console.warn('[Chat] AudioContext close:', e))
    }
  }, [])

  const playAudioBlob = useCallback(async (blob: Blob): Promise<void> => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext()
      }
      const ctx = audioCtxRef.current
      const arrayBuf = await blob.arrayBuffer()
      const audioBuf = await ctx.decodeAudioData(arrayBuf)
      const source = ctx.createBufferSource()
      source.buffer = audioBuf
      source.connect(ctx.destination)
      source.start(0)
      return new Promise((resolve) => {
        source.onended = () => resolve()
      })
    } catch (e) {
      console.warn('[Chat] Audio playback failed:', e)
    }
  }, [])

  // TTS: speak response
  const speak = useCallback((text: string, emotion?: Emotion) => {
    const currentSettings = useChatStore.getState().settings

    const useCustomTTS = currentSettings.ttsEnabled && currentSettings.ttsUrl
    if (useCustomTTS) {
      setSpeaking(true)
      const tts = new TTSClient(currentSettings)
      ttsClientRef.current = tts
      let playChain: Promise<void> = Promise.resolve()
      tts.onChunk = (chunk: TTSChunk) => {
        playChain = playChain.then(() => playAudioBlob(chunk.audio))
      }
      tts.onDone = () => {
        ttsClientRef.current = null
        setSpeaking(false)
      }
      tts.onError = () => {
        ttsClientRef.current = null
        setSpeaking(false)
      }
      tts.speak(text, emotion)
      return
    }

    // fallback: browser SpeechSynthesis
    if (!synthesis) return
    synthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.volume = currentSettings.volume
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    synthesis.speak(utterance)
  }, [setSpeaking, playAudioBlob])

  const handleSubmit = useCallback(async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText.trim() || isLoading) return

    const currentSettings = useChatStore.getState().settings

    if (currentSettings.apiProvider === 'openai' && !currentSettings.apiKey) {
      addMessage({ role: 'assistant', content: 'Please configure your API key in Settings first! Click the ⚙️ button to open settings.', emotion: 'confused' })
      return
    }
    if (currentSettings.apiProvider === 'ollama' && !currentSettings.ollamaUrl) {
      addMessage({ role: 'assistant', content: 'Please configure your Ollama URL in Settings first! Click the ⚙️ button to open settings.', emotion: 'confused' })
      return
    }
    if (!currentSettings.modelName || currentSettings.modelName.trim() === '') {
      addMessage({ role: 'assistant', content: '请先在设置中配置模型名称!点击 ⚙️ 按钮打开设置', emotion: 'confused' })
      return
    }

    setInput('')
    addMessage({ role: 'user', content: messageText, emotion: currentEmotion })
    stopIntroMode()

    const shouldSearch = isWebSearchMode
    let searchResultsContext = ''

    if (shouldSearch) {
      try {
        const searchResponse = await webSearch(messageText, currentSettings.searchApiKey, currentSettings.searchApiUrl)
        if (searchResponse.results.length > 0) {
          searchResultsContext = formatSearchResultsForLLM(searchResponse)
        } else {
          const errorInfo = searchResponse.error ? `\n\n错误详情: ${searchResponse.error}` : ''
          const providerInfo = searchResponse.provider !== 'none' ? `\n提供商: ${searchResponse.provider}` : ''
          addMessage({ role: 'assistant', content: `🔍 联网搜索未找到相关信息${providerInfo}${errorInfo}`, emotion: 'confused' })
        }
      } catch (searchError) {
        addMessage({ role: 'assistant', content: `🔍 联网搜索出错: ${searchError instanceof Error ? searchError.message : '未知错误'}`, emotion: 'confused' })
      }
    }

    setLoading(true)
    setCurrentEmotion('thinking')

    try {
      const currentPersonality = useChatStore.getState().personality
      let currentMessages = useChatStore.getState().messages
      let systemPrompt = getSystemPrompt(currentPersonality, currentSettings.language)
      if (searchResultsContext) {
        systemPrompt += `\n\n[重要 - 联网搜索结果]\n你必须根据以下实时搜索结果来回答用户的问题。如果搜索结果与你的知识不符，请以搜索结果为准。\n\n${searchResultsContext}\n\n请基于以上搜索结果回答用户问题。`
      }

      let fullResponse = ''
      await sendToLLM(
        currentMessages,
        currentSettings,
        systemPrompt,
        (chunk, isDone) => {
          if (!isDone) fullResponse += chunk
        },
        (emotion) => setCurrentEmotion(emotion)
      )

      const parsed = parseEmotionFromResponse(fullResponse, true)
      const displayText = parsed.content

      let finalEmotion = parsed.emotion
      if (parsed.content === fullResponse) {
        finalEmotion = await analyzeEmotionWithLLM(displayText, currentSettings)
      }

      // Override emotion based on user context
      const contextEmotion = analyzeEmotionFromContext(messageText, displayText, currentPersonality)
      const USER_TO_AVATAR: Partial<Record<Emotion, Emotion>> = {
        sad: 'concerned',      // 用户悲伤 → 关切安慰
        angry: 'concerned',    // 用户生气 → 安抚
        grateful: 'grateful',   // 用户感谢 → 感激
        love: 'love',           // 用户示爱 → 喜爱
        excited: 'excited',     // 用户兴奋 → 同步兴奋
        playful: 'playful',     // 用户调皮 → 同步调皮
      }
      const mapped = USER_TO_AVATAR[contextEmotion]
      if (mapped) {
        finalEmotion = mapped
      }

      setCurrentEmotion(finalEmotion)
      addMessage({ role: 'assistant', content: displayText, emotion: finalEmotion })

      // TTS playback: clean text and use matching emotional tone
      if (currentSettings.voiceEnabled && isSpeakerActive) {
        const ttsText = cleanTextForTTS(displayText)
        speak(ttsText, finalEmotion)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      let errorMessage = 'Sorry, I encountered an error.'
      const errorStr = error instanceof Error ? error.message : String(error)
      if (errorStr.includes('Model Not Exist') || errorStr.includes('invalid_request_error')) {
        errorMessage = '模型不存在!请检查设置中的模型名称是否正确或点击 ⚙️ 重新获取可用模型'
      } else if (errorStr.includes('401') || errorStr.includes('authentication')) {
        errorMessage = 'API Key 无效!请检查设置中 API Key 是否正确'
      } else if (errorStr.includes('403') || errorStr.includes('forbidden')) {
        errorMessage = '没有权限!请检查 API Key 是否有访问权限'
      } else if (errorStr.includes('404') || errorStr.includes('Not Found')) {
        errorMessage = 'API 端点错误!请检查 API URL 设置是否正确'
      } else if (errorStr.includes('network') || errorStr.includes('fetch')) {
        errorMessage = '网络错误!请检查网络连接是否正常'
      } else {
        errorMessage = `出错: ${errorStr}`
      }
      addMessage({ role: 'assistant', content: errorMessage, emotion: 'confused' })
    } finally {
      setLoading(false)
    }
  }, [input, isLoading, settings, personality, currentEmotion, isWebSearchMode, addMessage, setLoading, setCurrentEmotion, speak, isSpeakerActive])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Build a WAV Blob from Int16 PCM chunks
  function buildWavBlob(chunks: Int16Array[], sampleRate: number): Blob {
    const totalLen = chunks.reduce((s, c) => s + c.length, 0)
    const data = new Int16Array(totalLen)
    let offset = 0
    for (const c of chunks) { data.set(c, offset); offset += c.length }

    const numChannels = 1, bitsPerSample = 16
    const byteRate = sampleRate * numChannels * bitsPerSample / 8
    const blockAlign = numChannels * bitsPerSample / 8
    const dataSize = totalLen * 2
    const buf = new ArrayBuffer(44 + dataSize)
    const v = new DataView(buf)
    const w = (s: string, o: number) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
    w('RIFF', 0); v.setUint32(4, 36 + dataSize, true); w('WAVE', 8)
    w('fmt ', 12); v.setUint32(16, 16, true); v.setUint16(20, 1, true)
    v.setUint16(22, numChannels, true); v.setUint32(24, sampleRate, true)
    v.setUint32(28, byteRate, true); v.setUint16(32, blockAlign, true)
    v.setUint16(34, bitsPerSample, true); w('data', 36)
    v.setUint32(40, dataSize, true)
    new Int16Array(buf, 44).set(data)
    return new Blob([buf], { type: 'audio/wav' })
  }

  // ASR: start listening — buffer PCM or transcript, do NOT process yet
  const startListening = useCallback(() => {
    if (!isMicActive) return
    setIsListening(true)
    setCurrentEmotion('thinking')

    const useCustomASR = settings.asrEnabled && settings.asrUrl
    if (useCustomASR) {
      pcmBufferRef.current = []
      const capture = new AudioCapture({
        onChunk: (pcm) => { pcmBufferRef.current.push(new Int16Array(pcm)) },
        onError: () => setIsListening(false),
      })
      audioCaptureRef.current = capture
      capture.start()
      return
    }

    // fallback: browser SpeechRecognition (buffer transcripts on release)
    if (!recognition) {
      console.error('Speech recognition not supported')
      setIsListening(false)
      return
    }
    speechTranscriptRef.current = ''
    recognition.continuous = true
    recognition.interimResults = false
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          speechTranscriptRef.current += event.results[i][0].transcript
        }
      }
    }
    recognition.onerror = () => setIsListening(false)
    recognition.lang = inputLang
    recognition.start()
  }, [inputLang, settings.asrEnabled, settings.asrUrl, settings.asrApiKey, isMicActive])

  // ASR: stop listening — now process buffered audio/transcript
  const stopListening = useCallback(() => {
    const useCustomASR = settings.asrEnabled && settings.asrUrl
    if (useCustomASR) {
      audioCaptureRef.current?.stop()
      audioCaptureRef.current = null
      setIsListening(false)

      const chunks = pcmBufferRef.current
      pcmBufferRef.current = []
      if (chunks.length === 0) return

      const wavBlob = buildWavBlob(chunks, 16000)
      const fd = new FormData()
      fd.append('file', wavBlob, 'recording.wav')
      fd.append('model_name', 'funasr-nano')
      fd.append('language', '中文')
      fd.append('model', 'funasr-nano')

      const base = settings.asrUrl
        .replace(/\/+$/, '')
        .replace(/^ws:\/\//, 'http://')
        .replace(/^wss:\/\//, 'https://')
      fetch(`${base}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.asrApiKey}` },
        body: fd,
      })
        .then((r) => {
          if (!r.ok) throw new Error(`ASR server error: HTTP ${r.status}`)
          return r.json()
        })
        .then((data) => {
          if (data.text && data.text.trim()) {
            handleSubmit(data.text.trim())
          }
        })
        .catch((err) => {
          console.error('ASR transcription failed:', err)
        })
      return
    }

    // fallback: browser SpeechRecognition
    recognition?.stop()
    setIsListening(false)
    const transcript = speechTranscriptRef.current.trim()
    if (transcript) {
      setInput(transcript)
      handleSubmit(transcript)
    }
  }, [settings.asrEnabled, settings.asrUrl, settings.asrApiKey, handleSubmit])

  useEffect(() => {
    const { settings } = useChatStore.getState()
    if (settings.apiProvider === 'ollama') {
      checkOllamaConnection(settings.ollamaUrl).then(connected => {
        if (!connected) console.warn('Ollama not connected')
      })
    }
  }, [])

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-welcome">
            <div className="welcome-icon">✨</div>
            <h2>Welcome to aiAurora!</h2>
            <p>Your AI companion is ready to chat</p>
            <p className="welcome-hint">
              {settings.apiProvider === 'ollama'
                ? `Using local model: ${settings.modelName}`
                : `Using: ${settings.modelName}`
              }
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`message message-${message.role}`}
          >
            <div className="message-avatar">
              {message.role === 'assistant' ? '✨' : '👤'}
            </div>
            <div className="message-content">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message message-assistant">
            <div className="message-avatar">✨</div>
            <div className="message-content">
              <span className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <div className="chat-controls">
          {settings.voiceEnabled && (
            <>
              <button
                className={`control-btn ${isMicActive ? 'active' : ''}`}
                onClick={() => setIsMicActive((v) => !v)}
                title={isMicActive ? 'Disable microphone' : 'Enable microphone'}
              >
                🎤
              </button>
              <button
                className={`control-btn ${isSpeakerActive ? 'active' : ''}`}
                onClick={() => setIsSpeakerActive((v) => !v)}
                title={isSpeakerActive ? 'Disable speaker' : 'Enable speaker'}
              >
                🔊
              </button>
            </>
          )}
          <button
            className="control-btn"
            onClick={() => clearMessages()}
            title="Clear chat"
          >
            🗑️
          </button>
          {settings.webSearchEnabled && (
            <button
              className={`control-btn ${isWebSearchMode ? 'active' : ''}`}
              onClick={() => setIsWebSearchMode(!isWebSearchMode)}
              title="Toggle web search mode"
            >
              🔍
            </button>
          )}
        </div>

        <div className="input-wrapper">
          {isMicActive ? (
            <button
              className={`voice-btn ${isListening ? 'listening' : ''}`}
              onMouseDown={startListening}
              onMouseUp={stopListening}
              onMouseLeave={stopListening}
            >
              {isListening ? '🎙️ Listening...' : '🎤 Hold to speak'}
            </button>
          ) : (
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
            />
          )}

          <button
            className="send-btn"
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
          >
            ➤
          </button>
        </div>

        <div className="input-status">
          {isSpeaking && <span className="speaking-indicator">🔊 Speaking...</span>}
        </div>
      </div>
    </div>
  )
}
