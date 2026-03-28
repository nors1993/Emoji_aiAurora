import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { useChatStore, getSystemPrompt } from '../../stores/chatStore'
import { sendToLLM, checkOllamaConnection, parseEmotionFromResponse, analyzeEmotionWithLLM } from '../../utils/llm'
import { webSearch, formatSearchResultsForLLM } from '../../utils/webSearch'
import './Chat.css'

// Speech recognition setup
let recognition: SpeechRecognition | null = null
let synthesis: SpeechSynthesis | null = null

if (typeof window !== 'undefined') {
  // @ts-ignore - SpeechRecognition exists in browsers
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (SpeechRecognition) {
    recognition = new SpeechRecognition()
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
    isVoiceMode,
    setVoiceMode,
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
  
  // Debug: Log settings when they change
  useEffect(() => {
    console.log('=== CHAT SETTINGS UPDATE ===')
    console.log('settings in Chat:', JSON.stringify(settings))
    console.log('modelName in Chat:', settings.modelName)
    console.log('apiProvider in Chat:', settings.apiProvider)
  }, [settings])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  // Handle voice toggle from main process
  useEffect(() => {
    if (window.electron) {
      const unsubscribe = window.electron.onToggleVoice(() => {
        setVoiceMode(!isVoiceMode)
      })
      return unsubscribe
    }
  }, [isVoiceMode, setVoiceMode])
  
  // Speech recognition handlers
  const startListening = useCallback(() => {
    if (!recognition) {
      console.error('Speech recognition not supported')
      return
    }
    
    setIsListening(true)
    
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('')
      
      if (event.results[0].isFinal) {
        setInput(transcript)
        handleSubmit(transcript)
      }
    }
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }
    
    recognition.onend = () => {
      setIsListening(false)
    }
    
    recognition.lang = inputLang
    recognition.start()
  }, [inputLang])
  
  const stopListening = useCallback(() => {
    recognition?.stop()
    setIsListening(false)
  }, [])
  
  // Text-to-speech
  const speak = useCallback((text: string) => {
    const { settings: currentSettings } = useChatStore.getState()
    if (!synthesis || !currentSettings.voiceEnabled) return
    
    // Cancel any ongoing speech
    synthesis.cancel()
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.volume = currentSettings.volume
    utterance.rate = 1.0
    utterance.pitch = 1.0
    
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    
    synthesis.speak(utterance)
  }, [setSpeaking])
  
  const handleSubmit = useCallback(async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText.trim() || isLoading) return
    
    // Settings are now hydrated from localStorage at store creation time
    const currentSettings = useChatStore.getState().settings
    console.log('Chat: Using settings:', currentSettings)
    
    // Check API configuration before sending
    if (currentSettings.apiProvider === 'openai' && !currentSettings.apiKey) {
      addMessage({
        role: 'assistant',
        content: 'Please configure your API key in Settings first! Click the ⚙️ button to open settings.',
        emotion: 'confused'
      })
      return
    }
    
    if (currentSettings.apiProvider === 'ollama' && !currentSettings.ollamaUrl) {
      addMessage({
        role: 'assistant',
        content: 'Please configure your Ollama URL in Settings first! Click the ⚙️ button to open settings.',
        emotion: 'confused'
      })
      return
    }
    
    // Check model name is configured
    if (!currentSettings.modelName || currentSettings.modelName.trim() === '') {
      addMessage({
        role: 'assistant',
        content: '请先在设置中配置模型名称!点击 ⚙️ 按钮打开设置',
        emotion: 'confused'
      })
      return
    }
    
    // Clear input
    setInput('')
    
    // Add user message
    addMessage({
      role: 'user',
      content: messageText,
      emotion: currentEmotion
    })
    
    // Stop intro mode when user sends a message
    stopIntroMode()
    
    // Determine if we need to do a web search
    // Only manual mode: user clicks the web search button to enable it
    const shouldSearch = isWebSearchMode
    
    console.log('[WebSearch] Debug - webSearchEnabled:', currentSettings.webSearchEnabled)
    console.log('[WebSearch] Debug - isWebSearchMode:', isWebSearchMode)
    console.log('[WebSearch] Debug - shouldSearch:', shouldSearch)
    console.log('[WebSearch] Debug - messageText:', messageText)
    
    let searchResultsContext = ''
    let searchQuery = messageText
    
    // If web search is triggered, perform search FIRST before LLM call
    if (shouldSearch) {
      console.log('[WebSearch] ======== ENTERING SEARCH BLOCK ========')
      
      console.log('[WebSearch] Final search query:', searchQuery)
      
      try {
        const searchResponse = await webSearch(searchQuery, currentSettings.searchApiKey, currentSettings.searchApiUrl)
        
        console.log('[WebSearch] Response:', searchResponse)
        
        if (searchResponse.results.length > 0) {
          searchResultsContext = formatSearchResultsForLLM(searchResponse)
          console.log('[WebSearch] Got', searchResponse.results.length, 'results from', searchResponse.provider)
          
          // 不再添加"联网搜索中..."临时消息，直接让 LLM 回复
          // 搜索结果已注入到 systemPrompt 中
        } else if (shouldSearch) {
          // Only show "no results" message when user explicitly triggered the search
          // 显示更详细的错误信息帮助调试
          const errorInfo = searchResponse.error ? `\n\n错误详情: ${searchResponse.error}` : ''
          const providerInfo = searchResponse.provider !== 'none' ? `\n提供商: ${searchResponse.provider}` : ''
          addMessage({
            role: 'assistant',
            content: `🔍 联网搜索未找到相关信息${providerInfo}${errorInfo}`,
            emotion: 'confused'
          })
        }
      } catch (searchError) {
        console.error('[WebSearch] Search failed:', searchError)
        addMessage({
          role: 'assistant',
          content: `🔍 联网搜索出错: ${searchError instanceof Error ? searchError.message : '未知错误'}`,
          emotion: 'confused'
        })
      }
    }
    
    // Set loading state
    setLoading(true)
    setCurrentEmotion('thinking')
    
    try {
      // Use the settings already resolved above (localStorage > Zustand)
      // DO NOT re-read from Zustand here - it may have stale defaults
      const currentPersonality = useChatStore.getState().personality
      
      // Get current messages (include search results if any)
      let currentMessages = useChatStore.getState().messages
      
      // If we have search results, add them as context with clear instructions
      let systemPrompt = getSystemPrompt(currentPersonality, currentSettings.language)
      if (searchResultsContext) {
        // Add search results with explicit instruction to use them
        systemPrompt += `\n\n[重要 - 联网搜索结果]\n你必须根据以下实时搜索结果来回答用户的问题。如果搜索结果与你的知识不符，请以搜索结果为准。\n\n${searchResultsContext}\n\n请基于以上搜索结果回答用户问题。`
      }
      
      let fullResponse = ''
      
      // Stream response
      await sendToLLM(
        currentMessages,
        currentSettings,
        systemPrompt,
        (chunk, isDone) => {
          if (!isDone) {
            fullResponse += chunk
          }
        },
        (emotion) => {
          setCurrentEmotion(emotion)
        }
      )
      
      // Parse response to extract text and emotion
      const parsed = parseEmotionFromResponse(fullResponse, true)
      const displayText = parsed.content
      console.log('Parsed emotion:', parsed.emotion, 'Content:', displayText.substring(0, 50))
      
      // 优先使用 LLM 返回的 emotion 字段（JSON 解析成功时）
      // 仅当 JSON 解析失败时，调用 LLM 进行二次情绪分析
      let finalEmotion = parsed.emotion
      if (parsed.content === fullResponse) {
        // JSON 解析失败，使用 LLM 对回复文本进行分析
        console.log('JSON parse failed, using LLM emotion analysis...')
        finalEmotion = await analyzeEmotionWithLLM(displayText, currentSettings)
        console.log('LLM emotion analysis result:', finalEmotion)
      }
      console.log('Final emotion:', finalEmotion)
      
      // Update avatar emotion based on response
      setCurrentEmotion(finalEmotion)
      
      // Add assistant message with extracted text
      addMessage({
        role: 'assistant',
        content: displayText,
        emotion: finalEmotion
      })

      // Speak if voice is enabled
      if (currentSettings.voiceEnabled) {
        speak(displayText)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      
      // Provide helpful error messages
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
      
      addMessage({
        role: 'assistant',
        content: errorMessage,
        emotion: 'confused'
      })
    } finally {
      setLoading(false)
    }
  }, [input, isLoading, settings, personality, currentEmotion, isWebSearchMode, addMessage, setLoading, setCurrentEmotion, speak])
  
  // Handle keyboard input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }
  
  // Check Ollama connection on mount
  useEffect(() => {
    const { settings } = useChatStore.getState()
    if (settings.apiProvider === 'ollama') {
      checkOllamaConnection(settings.ollamaUrl).then(connected => {
        if (!connected) {
          console.warn('Ollama not connected')
        }
      })
    }
  }, [])
  
  return (
    <div className="chat-container">
      {/* Messages */}
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
      
      {/* Input area */}
      <div className="chat-input-container">
        <div className="chat-controls">
          {settings.voiceEnabled && (
            <button
              className={`control-btn ${isVoiceMode ? 'active' : ''}`}
              onClick={() => setVoiceMode(!isVoiceMode)}
              title="Toggle voice mode"
            >
              🎤
            </button>
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
          {isVoiceMode ? (
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
            ➤          </button>
        </div>
        
        <div className="input-status">
          {isSpeaking && <span className="speaking-indicator">🔊 Speaking...</span>}
        </div>
      </div>
    </div>
  )
}

