import { create } from 'zustand'
import { Message, Emotion, Settings, PERSONALITY_PROMPTS } from '../types'

interface ChatStore {
  // Messages
  messages: Message[]
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  
  // Loading state
  isLoading: boolean
  setLoading: (loading: boolean) => void
  
  // Voice state
  isVoiceMode: boolean
  setVoiceMode: (mode: boolean) => void
  isSpeaking: boolean
  setSpeaking: (speaking: boolean) => void
  
  // Emotion
  currentEmotion: Emotion
  setCurrentEmotion: (emotion: Emotion) => void
  // Display emotion - what's actually shown (includes random in intro mode)
  displayEmotion: Emotion
  setDisplayEmotion: (emotion: Emotion) => void
  
  // Intro mode - 随机展示情绪动画
  isIntroMode: boolean
  startIntroMode: () => void
  stopIntroMode: () => void
  
  // Settings
  settings: Settings
  setSettings: (settings: Partial<Settings>) => void
  personality: string
  setPersonality: (personality: string) => void
  
  // Clear
  clearMessages: () => void
}

const STORAGE_KEY = 'aiAurora_settings'
const PERSONALITY_KEY = 'aiAurora_personality'

const defaultSettings: Settings = {
  apiProvider: 'openai',
  apiUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: 'gpt-3.5-turbo',
  ollamaUrl: 'http://localhost:11434',
  avatarEmotion: 'happy',
  voiceEnabled: false,
  volume: 0.8,
  language: 'zh-CN',  // 默认中文
  webSearchEnabled: false,  // 默认关闭联网搜索
  scraplingUrl: 'http://localhost:8003',  // Scrapling 搜索服务器
  scraplingApiKey: 'sk-scrapling-demo',  // Scrapling 服务器 API Key

  // ASR 配置
  asrEnabled: false,
  asrUrl: 'http://localhost:8001',
  asrApiKey: 'sk-funasr-demo',

  // TTS 配置
  ttsEnabled: false,
  ttsUrl: 'http://localhost:8002',
  ttsApiKey: 'sk-qwen3tts-demo',
  ttsSpeaker: 'Vivian',
  ttsLanguage: 'Chinese',
}

// 在 store 创建时同步读取 localStorage，确保首次渲染就使用用户配置
function loadSettingsFromStorage(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...defaultSettings, ...parsed }
    }
  } catch (e) {
    console.error('[Settings] Failed to load from localStorage:', e)
  }
  return defaultSettings
}

function loadPersonalityFromStorage(): string {
  try {
    return localStorage.getItem(PERSONALITY_KEY) || 'default'
  } catch (e) {
    console.error('[Settings] Failed to load personality:', e)
    return 'default'
  }
}

export const useChatStore = create<ChatStore>((set) => ({
  // Messages
  messages: [],
  
  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now()
    }
    set((state) => ({
      messages: [...state.messages, newMessage]
    }))
  },
  
  // Loading
  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),
  
  // Voice
  isVoiceMode: false,
  setVoiceMode: (mode) => set({ isVoiceMode: mode }),
  isSpeaking: false,
  setSpeaking: (speaking) => set({ isSpeaking: speaking }),
  
  // Emotion
  currentEmotion: 'neutral',
  setCurrentEmotion: (emotion) => set({ currentEmotion: emotion }),
  
  // Display emotion - what's actually shown (includes random in intro mode)
  displayEmotion: 'neutral',
  setDisplayEmotion: (emotion) => set({ displayEmotion: emotion }),
  
  // Intro mode - 随机展示情绪动画（启动时和清除聊天时）
  isIntroMode: true,
  startIntroMode: () => set({ isIntroMode: true }),
  stopIntroMode: () => set({ isIntroMode: false }),
  
  // Settings - 从 localStorage 同步加载，首次渲染即生效
  settings: loadSettingsFromStorage(),
  setSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),
  personality: loadPersonalityFromStorage(),
  setPersonality: (personality) => set({ personality }),
  
  // Clear - 清除消息并重置情绪为 neutral，同时启动随机展示模式
  clearMessages: () => set({ messages: [], currentEmotion: 'neutral', isIntroMode: true })
}))

// Helper to get system prompt based on personality and language
export const getSystemPrompt = (personality: string, language: string = 'zh-CN'): string => {
  const basePrompt = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.default
  
  // Language instructions
  const languageInstructions: Record<string, string> = {
    'zh-CN': '请用简体中文回复。',
    'en-US': 'Please respond in English.',
    'ja-JP': '日本語で返信してください。',
    'ko-KR': '한국어로 답변해 주세요.',
    'fr-FR': 'Répondez en français.',
    'de-DE': 'Bitte auf Deutsch antworten.',
    'es-ES': 'Responde en español.',
    'pt-BR': 'Responda em português.',
    'ru-RU': 'Пожалуйста, отведите на русском языке.',
    'ar-SA': 'يرجى الرد باللغة العربية.',
  }
  
  const langInstruction = languageInstructions[language] || languageInstructions['zh-CN']
  
  // Get current date info
  const now = new Date()
  const currentDate = now.toLocaleDateString('zh-CN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    weekday: 'long'
  })
  const dateInstruction = `[重要] 当前日期和时间: ${currentDate}。如果用户问关于日期的问题（如今天星期几、今天几号等），请以此日期为准。搜索结果中的日期可能不准确，不要完全依赖搜索结果回答日期问题。`
  
  const emotionNames: Record<string, string> = {
    happy: '开心', excited: '兴奋', love: '喜爱', sad: '悲伤',
    concerned: '担忧', angry: '愤怒', surprised: '惊讶', fearful: '恐惧',
    disgusted: '厌恶', neutral: '平静', thinking: '思考', sleepy: '困倦',
    confused: '困惑', embarrassed: '窘迫', helpless: '无奈', jealous: '吃醋',
    longing: '怅然若失', shy: '害羞', playful: '调皮', proud: '自豪', grateful: '感激'
  }
  const emotionListStr = Object.entries(emotionNames).map(([k, v]) => `${v}="emotion":"${k}"`).join(', ')
  const emotionGameInstruction = `\n\n[重要: 情绪表达模式] 当用户要求你用特定情绪说话、展示情绪或玩情绪游戏时（如"用开心的语气说"、"表演悲伤的表情"、"玩情绪游戏"等），你必须先回复一个控制指令，格式为：{"emotion":"情绪的英文名称","action":"speak"}，然后再回复正常内容。\n\n情绪列表：${emotionListStr}\n\n重要：emotion的值必须是上面列表中的英文名称之一，不要自己创造情绪名称。例如：愤怒="emotion":"angry"，开心="emotion":"happy"，悲伤="emotion":"sad"`
  
  return `${basePrompt} ${langInstruction} ${dateInstruction}${emotionGameInstruction}`
}
