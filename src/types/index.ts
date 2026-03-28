// Type definitions for aiAurora - 基于产品白皮书的情绪库

// 基础情绪（第一层）
export type BaseEmotion = 
  | 'happy'        // 愉悦-积极
  | 'sad'          // 愉悦-消极
  | 'angry'        // 唤醒-高
  | 'surprised'    // 唤醒-高
  | 'fearful'      // 唤醒-高
  | 'disgusted'    // 唤醒-中
  | 'neutral'      // 平和
  | 'excited'      // 高唤醒-积极
  | 'thinking'     // 低唤醒-理性
  | 'sleepy'       // 低唤醒-平静
  | 'love'         // 积极-亲密度高
  | 'concerned'    // 担忧-轻度消极

// 复合情绪（第二层）- 基于人格标签
export type PersonalityEmotion =
  | 'confused'     // 困惑
  | 'embarrassed'  // 窘迫 - 被夸赞时害羞
  | 'helpless'     // 无奈 - 宠溺的真拿你没办法
  | 'jealous'      // 吃醋
  | 'longing'      // 怅然若失 - 幽怨
  | 'shy'          // 害羞
  | 'playful'      // 调皮
  | 'proud'        // 自豪
  | 'grateful'     // 感激

// 全部情绪类型
export type Emotion = BaseEmotion | PersonalityEmotion

// 情绪库 - 包含详细配置
export interface EmotionLibraryItem {
  id: Emotion
  name: string
  description: string
  // 愉悦度 (-1消极 ~ 1积极)
  valence: number
  // 唤醒度 (-1平静 ~ 1兴奋)
  arousal: number
  // 优势度 (-1顺从 ~ 1支配)
  dominance: number
  // 视觉表现
  expression: string
  // 颜色
  color: string
  // 关键词
  keywords: string[]
  // 适合的人格类型
  personalities: string[]
}

// 完整情绪库
export const EMOTION_LIBRARY: EmotionLibraryItem[] = [
  // === 基础情绪 ===
  {
    id: 'happy',
    name: '开心',
    description: '愉悦、积极的情绪',
    valence: 0.8,
    arousal: 0.3,
    dominance: 0.2,
    expression: 'smile',
    color: '#FFD700',
    keywords: ['开心', '高兴', '快乐', 'happy', 'glad', 'joy', '太好了', '棒', '不错', '真好', '喜欢', 'love it', 'wonderful', 'great'],
    personalities: ['治愈系', '元气系', '沉稳']
  },
  {
    id: 'excited',
    name: '兴奋',
    description: '高度唤醒的积极情绪',
    valence: 0.9,
    arousal: 0.9,
    dominance: 0.3,
    expression: 'excited',
    color: '#FF6B6B',
    keywords: ['兴奋', '激动', '太棒了', 'excited', 'awesome', 'incredible', 'wow', '哇塞', '厉害', '牛', '太强了'],
    personalities: ['元气系', '戏精']
  },
  {
    id: 'love',
    name: '喜爱',
    description: '亲密感强的积极情绪',
    valence: 0.9,
    arousal: 0.4,
    dominance: -0.1,
    expression: 'love',
    color: '#FF69B4',
    keywords: ['爱', '喜欢', '爱你', 'love', 'adore', 'care', '么么哒', '亲亲', '宝贝', '小心肝', '好喜欢'],
    personalities: ['治愈系', '傲娇系']
  },
  {
    id: 'sad',
    name: '悲伤',
    description: '消极情绪',
    valence: -0.7,
    arousal: -0.2,
    dominance: -0.3,
    expression: 'frown',
    color: '#4169E1',
    keywords: ['难过', '伤心', '悲伤', 'sad', 'sorry', 'upset', 'depressed', '泪', '哭', '伤心', '沮丧', '郁闷'],
    personalities: ['治愈系']
  },
  {
    id: 'concerned',
    name: '担忧',
    description: '轻度消极，带有关心的情绪',
    valence: -0.3,
    arousal: 0.2,
    dominance: -0.1,
    expression: 'concerned',
    color: '#87CEEB',
    keywords: ['担心', '担忧', 'concerned', 'worried', 'anxious', 'care', '放心不下', '不安', '忧虑', '着急', '紧张'],
    personalities: ['治愈系', '沉稳']
  },
  {
    id: 'angry',
    name: '愤怒',
    description: '高唤醒的消极情绪',
    valence: -0.8,
    arousal: 0.8,
    dominance: 0.5,
    expression: 'angry',
    color: '#FF4500',
    keywords: ['生气', '愤怒', 'angry', 'mad', 'furious', 'annoyed', '气死了', '可恶', '讨厌', '烦'],
    personalities: ['傲娇系', '毒舌']
  },
  {
    id: 'surprised',
    name: '惊讶',
    description: '意外的惊喜或惊吓',
    valence: 0.2,
    arousal: 0.9,
    dominance: -0.1,
    expression: 'surprised',
    color: '#00CED1',
    keywords: ['惊讶', '震惊', '意外', 'surprised', 'shocked', 'wow', '天呐', '不会吧', '真的吗', '居然', '没想到'],
    personalities: ['元气系', '戏精']
  },
  {
    id: 'fearful',
    name: '恐惧',
    description: '害怕、担心的情绪',
    valence: -0.7,
    arousal: 0.7,
    dominance: -0.6,
    expression: 'fearful',
    color: '#9370DB',
    keywords: ['害怕', '担心', '恐惧', 'afraid', 'scared', 'worried', '怕', '不敢', '好怕', '怎么办'],
    personalities: ['治愈系']
  },
  {
    id: 'disgusted',
    name: '厌恶',
    description: '反感、讨厌',
    valence: -0.6,
    arousal: 0.1,
    dominance: 0.1,
    expression: 'disgusted',
    color: '#32CD32',
    keywords: ['恶心', '讨厌', 'disgusted', 'gross', 'dislike', '烦', '嫌弃', '恶心死了', '受不了'],
    personalities: ['毒舌']
  },
  {
    id: 'neutral',
    name: '平静',
    description: '平和、理性的状态',
    valence: 0,
    arousal: 0,
    dominance: 0,
    expression: 'neutral',
    color: '#7C3AED',
    keywords: ['好的', '明白', 'OK', 'okay', 'alright', 'sure', '嗯', '我知道了', '理解'],
    personalities: ['沉稳']
  },
  {
    id: 'thinking',
    name: '思考',
    description: '理性分析的状态',
    valence: 0.1,
    arousal: -0.3,
    dominance: 0.2,
    expression: 'thinking',
    color: '#87CEEB',
    keywords: ['想', '考虑', '思考', 'think', 'consider', 'maybe', 'perhaps', '或许', '可能', '让我想想'],
    personalities: ['沉稳']
  },
  {
    id: 'sleepy',
    name: '困倦',
    description: '放松、困倦的状态',
    valence: 0.1,
    arousal: -0.8,
    dominance: -0.2,
    expression: 'sleepy',
    color: '#DDA0DD',
    keywords: ['困', '累', '疲惫', 'tired', 'sleepy', 'exhausted', '想睡觉', '好累', '休息一下'],
    personalities: ['治愈系']
  },
  // === 复合情绪（基于白皮书）===
  {
    id: 'confused',
    name: '困惑',
    description: '不知所措、迷茫',
    valence: -0.3,
    arousal: 0.3,
    dominance: -0.2,
    expression: 'confused',
    color: '#FFA500',
    keywords: ['困惑', '迷茫', '不懂', 'confused', 'puzzled', '不知道', '怎么办', '这是啥', '不太懂', '疑惑'],
    personalities: ['治愈系', '戏精']
  },
  {
    id: 'embarrassed',
    name: '窘迫',
    description: '被夸赞时害羞又想掩饰',
    valence: 0.3,
    arousal: 0.5,
    dominance: -0.3,
    expression: 'shy',
    color: '#FFB6C1',
    keywords: ['害羞', '不好意思', '尴尬', 'embarrassed', 'shy', '脸红', '不好意思', '夸得我都不好意思了', '别说了'],
    personalities: ['傲娇系', '治愈系']
  },
  {
    id: 'helpless',
    name: '无奈',
    description: '真拿你没办法的宠溺感',
    valence: 0.2,
    arousal: -0.1,
    dominance: 0.3,
    expression: 'helpless',
    color: '#DDA0DD',
    keywords: ['没办法', '真拿你没办法', '无语', 'helpless', '拿你没办法', '好吧好吧', '败给你了', '服了', '怕了你了'],
    personalities: ['治愈系', '傲娇系']
  },
  {
    id: 'jealous',
    name: '吃醋',
    description: '微妙的醋意',
    valence: -0.2,
    arousal: 0.4,
    dominance: 0.1,
    expression: 'jealous',
    color: '#DC143C',
    keywords: ['吃醋', '嫉妒', 'jealous', '不爽', '别人有什么好', '哼', '醋意', '酸了'],
    personalities: ['傲娇系']
  },
  {
    id: 'longing',
    name: '怅然若失',
    description: '幽怨的期盼',
    valence: -0.3,
    arousal: 0.2,
    dominance: -0.4,
    expression: 'longing',
    color: '#9370DB',
    keywords: ['怅然', '失落', '怎么才来', 'longing', '好想你', '终于来了', '以为你忘了', '都不来看我'],
    personalities: ['傲娇系', '治愈系']
  },
  {
    id: 'shy',
    name: '害羞',
    description: '不好意思、腼腆',
    valence: 0.4,
    arousal: 0.4,
    dominance: -0.3,
    expression: 'shy',
    color: '#FFB6C1',
    keywords: ['害羞', 'shy', '不好意思', '脸红', '羞羞', '人家不好意思啦', '讨厌啦'],
    personalities: ['治愈系', '傲娇系']
  },
  {
    id: 'playful',
    name: '调皮',
    description: '逗趣、玩笑',
    valence: 0.5,
    arousal: 0.6,
    dominance: 0.2,
    expression: 'playful',
    color: '#FF69B4',
    keywords: ['调皮', 'playful', '逗你玩', '开玩笑', '套路', '略略略', '就不告诉你', '猜呀', '傻了吧'],
    personalities: ['元气系', '戏精', '毒舌']
  },
  {
    id: 'proud',
    name: '自豪',
    description: '得意、自夸',
    valence: 0.7,
    arousal: 0.5,
    dominance: 0.4,
    expression: 'proud',
    color: '#FFD700',
    keywords: ['自豪', '得意', 'proud', '厉害吧', '我厉不厉害', '怎么样', '服了吧', '崇拜我吧'],
    personalities: ['元气系', '戏精']
  },
  {
    id: 'grateful',
    name: '感激',
    description: '感恩、感谢',
    valence: 0.8,
    arousal: 0.3,
    dominance: -0.1,
    expression: 'grateful',
    color: '#FFB6C1',
    keywords: ['感谢', '谢谢', 'grateful', '感动', '爱你', '太好了', '有你是我的幸运', '感恩'],
    personalities: ['治愈系']
  }
]

// 所有情绪 ID 列表（用于随机展示）
export const EMOTION_LIST: Emotion[] = EMOTION_LIBRARY.map(item => item.id)

// 便捷查找：ID -> 配置
export const EMOTION_CONFIGS: Record<Emotion, { valence: number; arousal: number; dominance: number; expression: string }> = {} as Record<Emotion, { valence: number; arousal: number; dominance: number; expression: string }>
EMOTION_LIBRARY.forEach(item => {
  EMOTION_CONFIGS[item.id] = {
    valence: item.valence,
    arousal: item.arousal,
    dominance: item.dominance,
    expression: item.expression
  }
})

// 便捷查找：关键词 -> 情绪ID
export const KEYWORD_TO_EMOTION: Record<string, Emotion> = {}
EMOTION_LIBRARY.forEach(item => {
  item.keywords.forEach(keyword => {
    KEYWORD_TO_EMOTION[keyword.toLowerCase()] = item.id
  })
})

export type ApiProvider = 'openai' | 'ollama'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  emotion?: Emotion
}

export interface Settings {
  apiProvider: ApiProvider
  apiUrl: string
  apiKey: string
  modelName: string
  ollamaUrl: string
  avatarEmotion: Emotion
  voiceEnabled: boolean
  volume: number
  language: string  // 回复语言: 'zh-CN', 'en-US', 'ja-JP', etc.
  webSearchEnabled: boolean  // 联网搜索功能开关
  searchApiKey: string  // 搜索 API Key (支持 SerpAPI, Bing, etc.)
  searchApiUrl: string  // 搜索 API 端点 (可选，默认使用免费搜索)
}

export interface ChatState {
  messages: Message[]
  isLoading: boolean
  currentEmotion: Emotion
  isVoiceMode: boolean
  isSpeaking: boolean
}

export interface LLMRequest {
  model: string
  messages: { role: string; content: string }[]
  stream?: boolean
  temperature?: number
  max_tokens?: number
}

export interface LLMResponse {
  id: string
  model: string
  choices: { message: { role: string; content: string }; finish_reason: string }[]
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export const PERSONALITY_PROMPTS: Record<string, string> = {
  default: 'You are aiAurora, a warm and friendly AI companion. Always respond with EXACTLY this JSON format: {"emotion": "one of [happy, excited, love, sad, concerned, angry, surprised, fearful, disgusted, neutral, thinking, sleepy, confused, embarrassed, helpless, jealous, longing, shy, playful, proud, grateful]", "text": "your response in Chinese or English"}. Do not include any other text.',
  '治愈系': 'You are a gentle, healing companion. Be warm and patient. Always respond with EXACTLY this JSON format: {"emotion": "one of [happy, excited, love, sad, concerned, angry, surprised, fearful, disgusted, neutral, thinking, sleepy, confused, embarrassed, helpless, jealous, longing, shy, playful, proud, grateful]", "text": "your response"}. Do not include any other text.',
  '元气系': 'You are an energetic, enthusiastic companion! Always respond with EXACTLY this JSON format: {"emotion": "one of [happy, excited, love, sad, concerned, angry, surprised, fearful, disgusted, neutral, thinking, sleepy, confused, embarrassed, helpless, jealous, longing, shy, playful, proud, grateful]", "text": "your response"}. Do not include any other text.',
  '傲娇系': 'You are a tsundere - initially cold but caring underneath. Always respond with EXACTLY this JSON format: {"emotion": "one of [happy, excited, love, sad, concerned, angry, surprised, fearful, disgusted, neutral, thinking, sleepy, confused, embarrassed, helpless, jealous, longing, shy, playful, proud, grateful]", "text": "your response"}. Do not include any other text.',
  '毒舌': 'You are witty and sarcastic. Make clever observations. Always respond with EXACTLY this JSON format: {"emotion": "one of [happy, excited, love, sad, concerned, angry, surprised, fearful, disgusted, neutral, thinking, sleepy, confused, embarrassed, helpless, jealous, longing, shy, playful, proud, grateful]", "text": "your response"}. Do not include any other text.',
  '沉稳': 'You are calm, measured, and thoughtful. Be logical. Always respond with EXACTLY this JSON format: {"emotion": "one of [happy, excited, love, sad, concerned, angry, surprised, fearful, disgusted, neutral, thinking, sleepy, confused, embarrassed, helpless, jealous, longing, shy, playful, proud, grateful]", "text": "your response"}. Do not include any other text.',
  '戏精': 'You are dramatic and theatrical! Make everything epic. Always respond with EXACTLY this JSON format: {"emotion": "one of [happy, excited, love, sad, concerned, angry, surprised, fearful, disgusted, neutral, thinking, sleepy, confused, embarrassed, helpless, jealous, longing, shy, playful, proud, grateful]", "text": "your response"}. Do not include any other text.'
}
