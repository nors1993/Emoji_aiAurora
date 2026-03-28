import { Settings, Emotion, Message, LLMRequest, KEYWORD_TO_EMOTION } from '../types'
import { consumeEventSourceStream } from './streamParser'

// Simple emotion detection based on keywords - 使用新的情绪库
export function detectEmotion(text: string): Emotion {
  const lowerText = text.toLowerCase()
  
  // 使用关键词匹配
  for (const [keyword, emotion] of Object.entries(KEYWORD_TO_EMOTION)) {
    if (lowerText.includes(keyword)) {
      return emotion
    }
  }
  
  // 基于标点符号和语气检测
  // 感叹号多 = 兴奋
  const exclamationCount = (text.match(/!/g) || []).length
  if (exclamationCount >= 2) {
    return 'excited'
  }
  
  // 问号多 = 困惑
  const questionCount = (text.match(/\?/g) || []).length
  if (questionCount >= 2) {
    return 'confused'
  }
  
  // 省略号 = 思考/无奈
  if (text.includes('...') || text.includes('……')) {
    return 'thinking'
  }
  
  // 默认返回中性
  return 'neutral'
}

// 基于上下文的情绪分析 - 考虑用户消息和模型回复
export function analyzeEmotionFromContext(
  userMessage: string, 
  assistantResponse: string, 
  personality: string
): Emotion {
  const lowerUser = userMessage.toLowerCase()
  const lowerResponse = assistantResponse.toLowerCase()
  
  // 用户表达悲伤/难过 → 模型应该回应治愈/同情
  if (lowerUser.includes('难过') || lowerUser.includes('伤心') || 
      lowerUser.includes('sad') || lowerUser.includes('crying') ||
      lowerUser.includes('哭') || lowerUser.includes('抑郁') ||
      lowerUser.includes('悲伤') || lowerUser.includes('痛苦') ||
      lowerUser.includes('沮丧') || lowerUser.includes('郁闷') ||
      lowerUser.includes('不幸') || lowerUser.includes('失望')) {
    return 'sad'
  }
  
  // 用户表达愤怒/生气 → 模型应该安抚或同情
  if (lowerUser.includes('生气') || lowerUser.includes('愤怒') || 
      lowerUser.includes('angry') || lowerUser.includes('烦') ||
      lowerUser.includes('讨厌') || lowerUser.includes('不爽')) {
    return 'sad'
  }
  
  // 用户感谢/赞美 → 模型应该感激/害羞
  if (lowerUser.includes('谢谢') || lowerUser.includes('感谢') || 
      lowerUser.includes('thank') || lowerUser.includes('棒') ||
      lowerUser.includes('厉害') || lowerUser.includes('爱你') ||
      lowerUser.includes('真好') || lowerUser.includes('太棒')) {
    return 'grateful'
  }
  
  // 用户问问题/困惑 → 模型应该帮助解答
  if (lowerUser.includes('怎么办') || lowerUser.includes('怎么') || 
      lowerUser.includes('为什么') || lowerUser.includes('?') ||
      lowerUser.includes('how') || lowerUser.includes('why') ||
      lowerUser.includes('什么') || lowerUser.includes('?')) {
    return 'thinking'
  }
  
  // 用户道歉 → 模型应该原谅/温暖
  if (lowerUser.includes('对不起') || lowerUser.includes('抱歉') || 
      lowerUser.includes('sorry') || lowerUser.includes('不好意思')) {
    return 'love'
  }
  
  // 用户表达爱意 → 模型应该回应喜爱
  if (lowerUser.includes('爱') || lowerUser.includes('love you') || 
      lowerUser.includes('喜欢你') || lowerUser.includes('么么哒')) {
    return 'love'
  }
  
  // 用户犯傻/搞笑 → 模型应该无奈/调皮
  if (lowerUser.includes('哈哈') || lowerUser.includes('笑死') || 
      lowerUser.includes('哈哈哈') || lowerUser.includes('LOL') ||
      lowerUser.includes('笑') || lowerUser.includes('太好笑了')) {
    return 'playful'
  }
  
  // 检测回复内容中的情绪关键词
  if (lowerResponse.includes('难过') || lowerResponse.includes('伤心') || 
      lowerResponse.includes('悲伤') || lowerResponse.includes('痛苦')) {
    return 'sad'
  }
  
  if (lowerResponse.includes('谢谢') || lowerResponse.includes('感谢') || 
      lowerResponse.includes('感动')) {
    return 'grateful'
  }
  
  // 基于人格特质的默认情绪
  switch (personality) {
    case '治愈系':
      return 'love'
    case '元气系':
      return 'excited'
    case '傲娇系':
      return Math.random() > 0.5 ? 'shy' : 'helpless'
    case '毒舌':
      return 'playful'
    case '沉稳':
      return 'neutral'
    case '戏精':
      return 'excited'
    default:
      return 'neutral'
  }
}

// Parse emotion from LLM response
export function parseEmotionFromResponse(text: string, isComplete: boolean = false): { emotion: Emotion; content: string } {
  // 如果响应完整，优先解析 JSON 格式
  if (isComplete) {
    try {
      // 预处理：去除 markdown 代码块包裹（```json ... ``` 或 ``` ... ```）
      let cleanText = text.trim()
      const codeBlockMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        cleanText = codeBlockMatch[1].trim()
      }
      
      // Try to find JSON in the response (non-greedy for nested braces safety)
      const jsonMatch = cleanText.match(/\{[^{}]*"emotion"[^{}]*"text"[^{}]*\}/) 
        || cleanText.match(/\{[^{}]*"text"[^{}]*"emotion"[^{}]*\}/)
        || cleanText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        
        // 优先使用 {"emotion": "...", "text": "..."} 格式
        if (parsed.emotion && parsed.text) {
          return {
            emotion: validateEmotion(parsed.emotion as string),
            content: parsed.text
          }
        }
        
        // 次选 {"message": "..."} 格式
        if (parsed.message && typeof parsed.message === 'string') {
          return {
            emotion: detectEmotion(parsed.message),
            content: parsed.message
          }
        }
      }
    } catch {
      // JSON parsing failed, continue below
    }
  }
  
  // 非完整响应或解析失败，使用关键词检测
  return {
    emotion: detectEmotion(text),
    content: text
  }
}

// Send message to LLM API
export async function sendToLLM(
  messages: Message[],
  settings: Settings,
  systemPrompt: string,
  onChunk: (chunk: string, isDone: boolean) => void,
  onEmotionChange: (emotion: Emotion) => void
): Promise<string> {
  const { apiProvider, apiUrl, apiKey, modelName, ollamaUrl } = settings
  
  console.log('=== LLM REQUEST ===')
  console.log('apiProvider:', apiProvider)
  console.log('apiUrl:', apiUrl)
  console.log('modelName:', modelName)
  console.log('apiKey (first 10 chars):', apiKey.substring(0, 10))
  
  const apiMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  ]
  
  if (apiProvider === 'openai') {
    // 确保 apiUrl 包含 /v1 路径
    const normalizedApiUrl = apiUrl.endsWith('/v1') ? apiUrl : `${apiUrl}/v1`
    return sendToOpenAI(normalizedApiUrl, apiKey, modelName, apiMessages, onChunk, onEmotionChange)
  } else {
    return sendToOllama(ollamaUrl, modelName, apiMessages, onChunk, onEmotionChange)
  }
}

async function sendToOpenAI(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  onChunk: (chunk: string, isDone: boolean) => void,
  onEmotionChange: (emotion: Emotion) => void
): Promise<string> {
  if (!apiKey) {
    throw new Error('API key is required')
  }
  
  const url = `${apiUrl}/chat/completions`
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  }
  
  const body: LLMRequest = {
    model,
    messages,
    stream: true,
    temperature: 0.8
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API error: ${response.status} - ${error}`)
  }
  
  if (!response.body) {
    throw new Error('No response body')
  }
  
  let fullContent = ''
  
  for await (const chunk of consumeEventSourceStream(response.body)) {
    if (chunk) {
      fullContent += chunk
      onChunk(chunk, false)
      // 流式传输期间不做情绪检测，保持 "thinking" 状态避免表情闪烁
    }
  }
  
  // Final emotion detection (complete response)
  const { emotion } = parseEmotionFromResponse(fullContent, true)
  onEmotionChange(emotion)
  onChunk('', true)
  
  return fullContent
}

async function sendToOllama(
  baseUrl: string,
  model: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  onChunk: (chunk: string, isDone: boolean) => void,
  onEmotionChange: (emotion: Emotion) => void
): Promise<string> {
  const url = `${baseUrl}/api/chat`
  
  const body = {
    model,
    messages,
    stream: true
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Ollama error: ${response.status} - ${error}`)
  }
  
  if (!response.body) {
    throw new Error('No response body')
  }
  
  let fullContent = ''
  
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line)
          if (data.message?.content) {
            fullContent += data.message.content
            onChunk(data.message.content, false)
            // 流式传输期间不做情绪检测，保持 "thinking" 状态避免表情闪烁
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  
  // Final emotion detection (complete response)
  const { emotion } = parseEmotionFromResponse(fullContent, true)
  onEmotionChange(emotion)
  onChunk('', true)
  
  return fullContent
}

// Check if Ollama is running
export async function checkOllamaConnection(url: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })
    return response.ok
  } catch {
    return false
  }
}

// Get available Ollama models
export async function getOllamaModels(url: string): Promise<string[]> {
  try {
    const response = await fetch(`${url}/api/tags`)
    if (!response.ok) return []
    
    const data = await response.json()
    return data.models?.map((m: { name: string }) => m.name) || []
  } catch {
    return []
  }
}

// 所有合法的情绪值
const VALID_EMOTIONS: Emotion[] = [
  'happy', 'excited', 'love', 'sad', 'concerned', 'angry', 'surprised', 'fearful',
  'disgusted', 'neutral', 'thinking', 'sleepy', 'confused', 'embarrassed',
  'helpless', 'jealous', 'longing', 'shy', 'playful', 'proud', 'grateful'
]

// 验证情绪是否有效，无效则返回 neutral（用于 parseEmotionFromResponse）
function validateEmotion(emotion: string): Emotion {
  const lowerEmotion = emotion.toLowerCase()
  
  // 精确匹配
  if (VALID_EMOTIONS.includes(lowerEmotion as Emotion)) {
    return lowerEmotion as Emotion
  }
  
  // 模糊匹配（如 LLM 返回 "sadness" 而非 "sad"，或 "concerned" 而非 "concerned"）
  const fuzzyMatch = VALID_EMOTIONS.find(e => lowerEmotion.includes(e))
  if (fuzzyMatch) {
    return fuzzyMatch
  }
  
  console.warn(`Unknown emotion "${emotion}", falling back to "neutral"`)
  return 'neutral'
}

// 使用用户配置的 LLM 对回复文本进行情绪分析
// 当 JSON 解析失败或 LLM 自报情绪不可靠时，作为二次分析手段
export async function analyzeEmotionWithLLM(
  text: string,
  settings: Settings
): Promise<Emotion> {
  const { apiProvider, apiUrl, apiKey, modelName, ollamaUrl } = settings
  
  const systemMessage = `You are an emotion analyzer. Analyze the emotional tone of the given text and return ONLY one emotion word from this exact list: [happy, excited, love, sad, concerned, angry, surprised, fearful, disgusted, neutral, thinking, sleepy, confused, embarrassed, helpless, jealous, longing, shy, playful, proud, grateful]. Return ONLY the single emotion word, nothing else. No punctuation, no explanation.`
  
  const messages = [
    { role: 'system' as const, content: systemMessage },
    { role: 'user' as const, content: text }
  ]
  
  try {
    let url: string
    let headers: Record<string, string>
    let body: Record<string, unknown>
    
    if (apiProvider === 'openai') {
      if (!apiKey) return detectEmotion(text)
      // 确保 apiUrl 包含 /v1 路径
      const normalizedApiUrl = apiUrl.endsWith('/v1') ? apiUrl : `${apiUrl}/v1`
      url = `${normalizedApiUrl}/chat/completions`
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
      body = {
        model: modelName,
        messages,
        stream: false,
        temperature: 0.1,
        max_tokens: 10
      }
    } else {
      url = `${ollamaUrl}/api/chat`
      headers = { 'Content-Type': 'application/json' }
      body = {
        model: modelName,
        messages,
        stream: false
      }
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000)  // 10 秒超时
    })
    
    if (!response.ok) {
      console.warn('Emotion analysis API call failed:', response.status)
      return detectEmotion(text)
    }
    
    const data = await response.json()
    
    let emotionStr: string
    if (apiProvider === 'openai') {
      emotionStr = (data.choices?.[0]?.message?.content || '').trim().toLowerCase()
    } else {
      emotionStr = (data.message?.content || '').trim().toLowerCase()
    }
    
    // 验证返回的情绪是否在合法列表中
    if (VALID_EMOTIONS.includes(emotionStr as Emotion)) {
      return emotionStr as Emotion
    }
    
    // 如果返回的不完全匹配，尝试模糊匹配（LLM 可能返回 "sadness" 而非 "sad"）
    const fuzzyMatch = VALID_EMOTIONS.find(e => emotionStr.includes(e))
    if (fuzzyMatch) {
      return fuzzyMatch
    }
    
    console.warn('LLM returned invalid emotion:', emotionStr, ', falling back to keyword detection')
    return detectEmotion(text)
  } catch (error) {
    console.warn('Emotion analysis failed, falling back to keyword detection:', error)
    return detectEmotion(text)
  }
}
