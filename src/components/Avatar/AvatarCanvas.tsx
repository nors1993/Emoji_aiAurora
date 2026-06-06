import { Canvas } from '@react-three/fiber'
import { OrbitControls, Float } from '@react-three/drei'
import { Suspense, useRef, useEffect, useState, useMemo } from 'react'
import * as THREE from 'three'
import { useChatStore } from '../../stores/chatStore'
import { Emotion, EMOTION_LIST } from '../../types'
import './Avatar.css'

// 只有愤怒情绪才会触发抖动
const ANGRY_SHAKE_EMOTIONS = ['angry']

// 高强度情绪（触发脉动效果）
const INTENSE_EMOTIONS = ['excited', 'happy', 'love', 'angry', 'proud', 'playful']

// 情绪 -> 颜色映射（确保情绪与颜色一一对应，每个情绪颜色唯一）
const EMOTION_COLORS: Record<string, string> = {
  happy: '#FFD700',      // 金色
  excited: '#FF7E7E',    // 柔红
  love: '#FF85C8',       // 柔粉
  sad: '#6B8FF0',        // 柔蓝
  angry: '#FF6B33',      // 柔橙红
  surprised: '#40D8DB',  // 柔青
  fearful: '#B08FE5',    // 柔紫
  disgusted: '#5CD85C',  // 柔绿
  neutral: '#7C3AED',    // 紫罗兰
  thinking: '#87CEEB',   // 天蓝色
  sleepy: '#8B7BA8',     // 柔深紫
  confused: '#FFB933',   // 柔橙
  embarrassed: '#FFB6C1',// 浅粉色
  helpless: '#8FA0A8',   // 柔石板灰
  jealous: '#E84563',    // 柔深红
  longing: '#A86BA5',   // 柔中紫红
  shy: '#FF85A2',        // 亮粉色
  playful: '#4DC4BD',    // 柔浅海绿
  proud: '#E4B840',      // 柔金麒麟色
  grateful: '#FF85C8',   // 柔粉
}

// 眼睛配置类型 - 每个情绪独特的眼睛参数
interface EyeConfig {
  eyeScale: [number, number]        // 眼睛宽高缩放
  pupilScale: number                 // 瞳孔大小倍数
  pupilOffset: [number, number]      // 瞳孔偏移 [x, y]
  isClosed: boolean                  // 是否闭眼
  hasSparkle: boolean                // 是否有高光 sparkle
  isWink: boolean                    // 是否眨眼（用于 playful）
  eyeShape: 'normal' | 'squinted' | 'droopy' | 'narrowed' | 'halfLidded' | 'wide' | 'asymmetric'  // 眼睛形状变体
  pupilDilation: number              // 瞳孔扩张程度 (0.7=收缩, 1.0=正常, 1.3=扩张)
  hasTear: boolean                   // 是否有泪光
  hasEyeShadow: boolean              // 是否有眼影
}

// 眼睛配置映射 - 20 种情绪各有独特的眼睛
const EYE_CONFIGS: Record<Emotion, EyeConfig> = {
  // 开心 - 轻微笑眼 (happy crescent)
  happy: {
    eyeScale: [1.0, 0.85],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: false,
    eyeShape: 'squinted',
    pupilDilation: 1.1,
    hasTear: false,
    hasEyeShadow: false
  },
  // 兴奋 - 睁大 + 高光
  excited: {
    eyeScale: [1.3, 1.3],
    pupilScale: 1.3,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: false,
    eyeShape: 'wide',
    pupilDilation: 1.2,
    hasTear: false,
    hasEyeShadow: false
  },
  // 爱 - 半闭眼 + 高光
  love: {
    eyeScale: [1.0, 0.8],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: false,
    eyeShape: 'halfLidded',
    pupilDilation: 1.05,
    hasTear: false,
    hasEyeShadow: true
  },
  // 悲伤 - 下垂 + 瞳孔变小 + 泪光
  sad: {
    eyeScale: [1.0, 0.95],
    pupilScale: 0.85,
    pupilOffset: [0, -0.02],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'droopy',
    pupilDilation: 0.8,
    hasTear: true,
    hasEyeShadow: false
  },
  // 愤怒 - 斜眼眯眼 + 眼影
  angry: {
    eyeScale: [1.0, 0.9],
    pupilScale: 1.0,
    pupilOffset: [0.03, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'narrowed',
    pupilDilation: 0.9,
    hasTear: false,
    hasEyeShadow: true
  },
  // 惊讶 - 瞪大眼
  surprised: {
    eyeScale: [1.4, 1.4],
    pupilScale: 1.3,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: false,
    eyeShape: 'wide',
    pupilDilation: 1.3,
    hasTear: false,
    hasEyeShadow: false
  },
  // 恐惧 - 瞪大 + 瞳孔扩张
  fearful: {
    eyeScale: [1.35, 1.35],
    pupilScale: 1.25,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'wide',
    pupilDilation: 1.3,
    hasTear: true,
    hasEyeShadow: false
  },
  // 厌恶 - 眯眼 + 不对称
  disgusted: {
    eyeScale: [1.0, 0.85],
    pupilScale: 0.9,
    pupilOffset: [-0.02, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'asymmetric',
    pupilDilation: 0.85,
    hasTear: false,
    hasEyeShadow: false
  },
  // 中性 - 正常
  neutral: {
    eyeScale: [1.0, 1.0],
    pupilScale: 0.75,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: false,
    eyeShape: 'normal',
    pupilDilation: 1.0,
    hasTear: false,
    hasEyeShadow: false
  },
  // 思考 - 略眯眼
  thinking: {
    eyeScale: [1.0, 0.95],
    pupilScale: 1.0,
    pupilOffset: [0, 0.05],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'halfLidded',
    pupilDilation: 0.95,
    hasTear: false,
    hasEyeShadow: false
  },
// 困倦 - 几乎闭上
  sleepy: {
    eyeScale: [1.0, 0.15],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: true,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'droopy',
    pupilDilation: 0.7,
    hasTear: false,
    hasEyeShadow: false
  },
  // 担忧 - 轻微眯眼 + 略微下垂
  concerned: {
    eyeScale: [1.0, 0.85],
    pupilScale: 0.9,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'normal',
    pupilDilation: 0.9,
    hasTear: false,
    hasEyeShadow: false
  },
  // 困惑 - 不对称眯眼
  confused: {
    eyeScale: [1.1, 1.0],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'asymmetric',
    pupilDilation: 0.95,
    hasTear: false,
    hasEyeShadow: false
  },
  // 窘迫 - 目光躲避 + 眼影
  embarrassed: {
    eyeScale: [1.0, 0.85],
    pupilScale: 0.9,
    pupilOffset: [-0.04, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'halfLidded',
    pupilDilation: 0.85,
    hasTear: false,
    hasEyeShadow: true
  },
  // 无助 - 柔和下垂
  helpless: {
    eyeScale: [1.0, 0.95],
    pupilScale: 1.0,
    pupilOffset: [0, -0.02],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'droopy',
    pupilDilation: 0.85,
    hasTear: true,
    hasEyeShadow: false
  },
  // 嫉妒 - 斜眼眯眼
  jealous: {
    eyeScale: [0.9, 0.8],
    pupilScale: 1.0,
    pupilOffset: [0.06, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'narrowed',
    pupilDilation: 0.9,
    hasTear: false,
    hasEyeShadow: true
  },
  // 怅然若失 - 轻微下垂 + 远望
  longing: {
    eyeScale: [1.0, 0.9],
    pupilScale: 0.9,
    pupilOffset: [0, 0.03],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'droopy',
    pupilDilation: 0.85,
    hasTear: true,
    hasEyeShadow: false
  },
  // 害羞 - 目光躲避 + 半闭
  shy: {
    eyeScale: [1.0, 0.8],
    pupilScale: 1.0,
    pupilOffset: [-0.05, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'halfLidded',
    pupilDilation: 0.9,
    hasTear: false,
    hasEyeShadow: true
  },
  // 调皮 - 眨眼 + 高光
  playful: {
    eyeScale: [1.0, 1.0],
    pupilScale: 1.2,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: true,
    eyeShape: 'normal',
    pupilDilation: 1.1,
    hasTear: false,
    hasEyeShadow: false
  },
  // 自豪 - 轻微闭眼 + 高光
  proud: {
    eyeScale: [1.0, 0.85],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: false,
    eyeShape: 'squinted',
    pupilDilation: 1.1,
    hasTear: false,
    hasEyeShadow: false
  },
  // 感激 - 柔和温暖 + 高光
  grateful: {
    eyeScale: [1.0, 0.9],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: false,
    eyeShape: 'halfLidded',
    pupilDilation: 1.05,
    hasTear: false,
    hasEyeShadow: true
  }
}

// 眉毛配置类型
interface EyebrowConfig {
  rotation: number           // 旋转角度
  verticalOffset: number      // 垂直偏移
  isAsymmetric: boolean      // 是否不对称
  leftRotation?: number      // 左侧眉毛角度（用于不对称）
  rightRotation?: number     // 右侧眉毛角度（用于不对称）
}

// 眉毛配置映射 - 每个情绪独特的眉毛（增强不对称效果）
const EYEBROW_CONFIGS: Record<Emotion, EyebrowConfig> = {
  // 开心 - 放松微抬
  happy: {
    rotation: 0,
    verticalOffset: 0.05,
    isAsymmetric: false
  },
  // 兴奋 - 高抬
  excited: {
    rotation: -0.4,
    verticalOffset: 0.1,
    isAsymmetric: false
  },
  // 爱 - 柔和拱形
  love: {
    rotation: -0.15,
    verticalOffset: 0,
    isAsymmetric: false
  },
  // 悲伤 - 内角抬起
  sad: {
    rotation: 0.15,
    verticalOffset: 0.08,
    isAsymmetric: false
  },
  // 担忧 - 轻微皱起（担忧的眉毛）
  concerned: {
    rotation: 0.1,
    verticalOffset: 0.02,
    isAsymmetric: false
  },
  // 愤怒 - V 形下沉（但不要沉太深）
  angry: {
    rotation: 0.3,
    verticalOffset: 0.05,
    isAsymmetric: false
  },
  // 惊讶 - 高抬
  surprised: {
    rotation: -0.5,
    verticalOffset: 0.12,
    isAsymmetric: false
  },
  // 恐惧 - 高抬 + 紧锁
  fearful: {
    rotation: -0.3,
    verticalOffset: 0.08,
    isAsymmetric: false
  },
  // 厌恶 - 皱眉但要抬起
  disgusted: {
    rotation: 0.1,
    verticalOffset: 0.05,
    isAsymmetric: true,
    leftRotation: 0.2,
    rightRotation: 0.05
  },
  // 中性 - 平板
  neutral: {
    rotation: 0,
    verticalOffset: 0,
    isAsymmetric: false
  },
  // 思考 - 一侧抬起（更明显）
  thinking: {
    rotation: 0,
    verticalOffset: 0,
    isAsymmetric: true,
    leftRotation: -0.3,
    rightRotation: 0.05
  },
  // 困倦 - 下垂（但不要太多）
  sleepy: {
    rotation: 0.05,
    verticalOffset: 0.05,
    isAsymmetric: false
  },
  // 困惑 - 不对称
  confused: {
    rotation: 0,
    verticalOffset: 0.05,
    isAsymmetric: true,
    leftRotation: -0.25,
    rightRotation: 0.1
  },
  // 窘迫 - 不对称
  embarrassed: {
    rotation: -0.05,
    verticalOffset: 0.05,
    isAsymmetric: true,
    leftRotation: 0,
    rightRotation: -0.1
  },
  // 无助 - 不对称
  helpless: {
    rotation: 0,
    verticalOffset: 0.05,
    isAsymmetric: true,
    leftRotation: 0.05,
    rightRotation: -0.1
  },
  // 嫉妒 - 不对称
  jealous: {
    rotation: 0,
    verticalOffset: 0.05,
    isAsymmetric: true,
    leftRotation: 0.2,
    rightRotation: -0.1
  },
  // 怅然若失 - 不对称
  longing: {
    rotation: -0.05,
    verticalOffset: 0.05,
    isAsymmetric: true,
    leftRotation: 0,
    rightRotation: -0.15
  },
  // 害羞 - 不对称
  shy: {
    rotation: -0.05,
    verticalOffset: 0.05,
    isAsymmetric: true,
    leftRotation: -0.1,
    rightRotation: 0
  },
  // 调皮 - 不对称
  playful: {
    rotation: 0,
    verticalOffset: 0.05,
    isAsymmetric: true,
    leftRotation: -0.25,
    rightRotation: 0.1
  },
  // 自豪 - 略抬
  proud: {
    rotation: -0.1,
    verticalOffset: 0.08,
    isAsymmetric: false
  },
  // 感激 - 柔和拱形
  grateful: {
    rotation: -0.08,
    verticalOffset: 0.05,
    isAsymmetric: false
  }
}

// 嘴巴形状类型 - 扩展到 19 种
type MouthShape = 
  | 'smile'          // 微笑 - 向上弧线
  | 'bigSmile'       // 大笑 - 宽弧线 + 张嘴
  | 'grin'           // 龇牙 - 开心露齿
  | 'frown'          // 向下弧线（中间下弯）
  | 'downturned'     // 嘴角下弯 - 嘴角向下撇（悲伤专用）
  | 'open'           // 张大嘴 - 惊讶
  | 'openSmall'      // 小张嘴 - 紧张
  | 'neutral'        // 中性 - 平板线
  | 'pout'           // 愤怒收紧
  | 'wavy'           // 纠结波浪
  | 'shy'            // 害羞抿嘴
  | 'disgust'        // 厌恶 - 不对称下弯
  | 'snarl'          // 愤怒 - 龇牙
  | 'sigh'           // 无助 - 小椭圆
  | 'tightFrown'     // 嫉妒 - 紧下弯
  | 'yawn'           // 困倦 - 中等张开
  | 'hmm'            // 思考 - 略歪
  | 'warmSmile'      // 感激 - 柔和宽笑
  | 'smirk'          // 自豪 - 不对称上扬
  | 'slightFrown'    // 怅然若失 - 轻下弯
  | 'shySmile'       // 窘迫 - 小上扬
  | 'tinySmile'      // 害羞 - 极小上扬
  | 'concerned'      // 担忧 - 轻微下弯

// 嘴巴配置映射 - 每个情绪独特的嘴巴
const MOUTH_CONFIGS: Record<Emotion, MouthShape> = {
  happy: 'smile',
  excited: 'bigSmile',
  love: 'smile',         // 甜蜜微笑（比 happy 略小弧度，由渲染控制）
  sad: 'downturned',    // 悲伤 - 嘴角下弯
  concerned: 'concerned', // 担忧 - 轻微下弯
  angry: 'pout',
  surprised: 'open',
  fearful: 'openSmall',
  disgusted: 'disgust',
  neutral: 'neutral',
  thinking: 'hmm',
  sleepy: 'neutral',
  confused: 'wavy',
  embarrassed: 'shySmile',
  helpless: 'sigh',
  jealous: 'tightFrown',
  longing: 'slightFrown',
  shy: 'tinySmile',
  playful: 'grin',
  proud: 'smirk',
  grateful: 'warmSmile'
}

// 脸颊配置类型
interface CheekConfig {
  color: string
  opacity: number
}

// 脸颊配置映射 - 每个情绪独特的腮红
const CHEEK_CONFIGS: Record<Emotion, CheekConfig> = {
  // 开心 - 粉色
  happy: {
    color: '#FF69B4',
    opacity: 0.5
  },
  // 兴奋 - 粉色更强
  excited: {
    color: '#FF69B4',
    opacity: 0.6
  },
  // 爱 - 粉色最强
  love: {
    color: '#FF69B4',
    opacity: 0.7
  },
  // 悲伤 - 无
  sad: {
    color: '#FF69B4',
    opacity: 0.05
  },
  // 担忧 - 轻微苍白
  concerned: {
    color: '#E8E0FF',
    opacity: 0.15
  },
  // 愤怒 - 红色
  angry: {
    color: '#FF4444',
    opacity: 0.3
  },
  // 惊讶 - 无
  surprised: {
    color: '#FF69B4',
    opacity: 0.05
  },
  // 恐惧 - 苍白
  fearful: {
    color: '#E8E0FF',
    opacity: 0.2
  },
  // 厌恶 - 绿色
  disgusted: {
    color: '#90EE90',
    opacity: 0.25
  },
  // 中性 - 无
  neutral: {
    color: '#FF69B4',
    opacity: 0.05
  },
  // 思考 - 无
  thinking: {
    color: '#FF69B4',
    opacity: 0.05
  },
  // 困倦 - 无
  sleepy: {
    color: '#FF69B4',
    opacity: 0.05
  },
  // 困惑 - 无
  confused: {
    color: '#FF69B4',
    opacity: 0.05
  },
  // 窘迫 - 红色
  embarrassed: {
    color: '#FF6B6B',
    opacity: 0.5
  },
  // 无助 - 无
  helpless: {
    color: '#FF69B4',
    opacity: 0.05
  },
  // 嫉妒 - 无（轻微）
  jealous: {
    color: '#FF69B4',
    opacity: 0.1
  },
  // 怅然若失 - 无
  longing: {
    color: '#FF69B4',
    opacity: 0.05
  },
  // 害羞 - 红色
  shy: {
    color: '#FF6B6B',
    opacity: 0.55
  },
  // 调皮 - 粉色
  playful: {
    color: '#FF69B4',
    opacity: 0.4
  },
  // 自豪 - 无（轻微）
  proud: {
    color: '#FF69B4',
    opacity: 0.1
  },
  // 感激 - 暖粉色
  grateful: {
    color: '#FFB6C1',
    opacity: 0.4
  }
}

// Aurora Avatar - A cute floating orb/creature
function AuroraAvatar() {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const storeEmotion = useChatStore((state) => state.currentEmotion) || 'neutral'
  const isLoading = useChatStore((state) => state.isLoading) || false
  const isIntroMode = useChatStore((state) => state.isIntroMode) || false
  const storeDisplayEmotion = useChatStore((state) => state.displayEmotion) || 'neutral'
  const setStoreDisplayEmotion = useChatStore((state) => state.setDisplayEmotion)
  
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 })
  const [pulseScale, setPulseScale] = useState(1)
  const [breathScale, setBreathScale] = useState(1)
  const [eyeLookOffset, setEyeLookOffset] = useState({ x: 0, y: 0 }) // 眼睛微动效果
  
  // Intro mode: 随机循环展示情绪，每2秒切换一次
  // 模型响应中(isLoading=true)不更新，保持上一个稳定表情
  useEffect(() => {
    if (isIntroMode) {
      const interval = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * EMOTION_LIST.length)
        const randomEmotion = EMOTION_LIST[randomIndex]
        setStoreDisplayEmotion(randomEmotion)
      }, 2000) // 每2秒切换
      
      return () => clearInterval(interval)
    } else if (!isLoading) {
      // 非 intro 模式且非加载中时，使用 store 中的情绪
      setStoreDisplayEmotion(storeEmotion)
    }
    // 加载中(isLoading=true)不更新，保持上一个稳定表情
  }, [isIntroMode, isLoading, storeEmotion, setStoreDisplayEmotion])
  
  const displayEmotion = storeDisplayEmotion
  
  // Check if emotion is intense
  const isIntense = INTENSE_EMOTIONS.includes(displayEmotion)
  
  // Get color for current emotion
  const targetColor = EMOTION_COLORS[displayEmotion] || '#7C3AED'
  
  // Animate color and opacity based on emotion (smooth transition)
  useEffect(() => {
    if (!meshRef.current) return
    
    const material = meshRef.current.material as THREE.MeshStandardMaterial
    const color = new THREE.Color(targetColor)
    
    // 不同的情绪有不透明的呼吸效果
    const targetOpacity = isIntense ? 0.95 : 0.85
    const targetEmissive = isIntense ? 0.6 : 0.3
    
    // Smooth color transition
    const lerpFactor = isIntense ? 0.12 : 0.04
    const animateColor = () => {
      material.color.lerp(color, lerpFactor)
      material.emissive.lerp(color, lerpFactor)
      // 平滑过渡不透明度和发光强度
      material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, lerpFactor)
      material.emissiveIntensity = THREE.MathUtils.lerp(material.emissiveIntensity, targetEmissive, lerpFactor)
    }
    
    const interval = setInterval(animateColor, 16)
    return () => clearInterval(interval)
  }, [displayEmotion, isIntense, targetColor])
  
  // 只有愤怒情绪才会触发抖动
  const isAngry = ANGRY_SHAKE_EMOTIONS.includes(displayEmotion)
  
  // Shaking effect - only for angry
  useEffect(() => {
    if (!isAngry) {
      setShakeOffset({ x: 0, y: 0 })
      return
    }
    
    const shakeInterval = setInterval(() => {
      const intensity = 0.15
      setShakeOffset({
        x: (Math.random() - 0.5) * intensity,
        y: (Math.random() - 0.5) * intensity
      })
    }, 50)
    
    return () => clearInterval(shakeInterval)
  }, [displayEmotion, isAngry])
  
  // Pulse effect for intense emotions + subtle breathing for all emotions
  useEffect(() => {
    if (!isIntense && !isLoading) {
      setPulseScale(1)
      setBreathScale(1)
      return
    }
    
    let startTime = Date.now()
    const pulseInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      // 高强度情绪：快速脉动
      const frequency = displayEmotion === 'excited' ? 8 : 4
      const amplitude = displayEmotion === 'excited' ? 0.15 : 0.08
      const scale = 1 + Math.sin(elapsed * frequency * 0.001) * amplitude
      setPulseScale(scale)
      
      // 微妙的呼吸效果（所有情绪都有）
      const breathFreq = 1.5 // 更慢的呼吸
      const breathAmp = 0.02 // 非常微妙的呼吸
      const breath = 1 + Math.sin(elapsed * breathFreq * 0.001) * breathAmp
      setBreathScale(breath)
    }, 16)
    
    return () => clearInterval(pulseInterval)
  }, [displayEmotion, isIntense, isLoading])
  
  // Calculate scale with pulse effect + breathing
  const baseScale = isLoading ? 1.05 : 1
  const finalScale = baseScale * pulseScale * breathScale

  // 微表情：眼睛微动效果（根据情绪类型）
  useEffect(() => {
    // 特定情绪有更明显的眼睛移动
    const lookAroundEmotions = ['thinking', 'confused', 'concerned', 'longing']
    const shouldLookAround = lookAroundEmotions.includes(displayEmotion)
    
    if (!shouldLookAround && !isLoading) {
      setEyeLookOffset({ x: 0, y: 0 })
      return
    }
    
    const lookInterval = setInterval(() => {
      const intensity = shouldLookAround ? 0.03 : 0.015
      const x = (Math.random() - 0.5) * intensity
      const y = (Math.random() - 0.5) * intensity
      setEyeLookOffset({ x, y })
    }, 2000) // 每2秒轻微移动
    
    return () => clearInterval(lookInterval)
  }, [displayEmotion, isLoading])

  return (
    <group ref={groupRef} position={[shakeOffset.x, shakeOffset.y, 0]}>
      <Float
        speed={isIntense ? 4 : 2}
        rotationIntensity={isIntense ? 1 : 0.5}
        floatIntensity={isIntense ? 1.5 : 0.5}
      >
        <group scale={[finalScale, finalScale, finalScale]}>
          {/* Main body - Aurora orb */}
          <mesh ref={meshRef} castShadow>
            <sphereGeometry args={[1.5, 64, 64]} />
            <meshStandardMaterial
              color={targetColor}
              emissive={targetColor}
              emissiveIntensity={isIntense ? 0.6 : 0.3}
              metalness={0.2}
              roughness={0.3}
              transparent
              opacity={0.96}
            />
          </mesh>
          
          {/* Inner glow - stronger for intense emotions */}
          <mesh scale={[1.2, 1.2, 1.2]}>
            <sphereGeometry args={[1.5, 32, 32]} />
            <meshBasicMaterial
              color={targetColor}
              transparent
              opacity={isIntense ? 0.4 : 0.2}
              side={THREE.BackSide}
            />
          </mesh>
          
          {/* Outer glow ring for intense emotions */}
          {isIntense && (
            <mesh scale={[1.8, 1.8, 1.8]}>
              <sphereGeometry args={[1.5, 32, 32]} />
              <meshBasicMaterial
                color={targetColor}
                transparent
                opacity={0.15}
                side={THREE.BackSide}
              />
            </mesh>
          )}
          
          {/* Eyes - now with side prop for asymmetric expressions */}
          <Eye position={[-0.4, 0.2, 1.2]} emotion={displayEmotion} side="left" lookOffset={eyeLookOffset} />
          <Eye position={[0.4, 0.2, 1.2]} emotion={displayEmotion} side="right" lookOffset={eyeLookOffset} />
          
          {/* Mouth */}
          <Mouth position={[0, -0.3, 1.3]} emotion={displayEmotion} />
          
          {/* Cheeks - more visible for happy emotions */}
          <Cheek position={[-0.7, -0.1, 1]} emotion={displayEmotion} />
          <Cheek position={[0.7, -0.1, 1]} emotion={displayEmotion} />
          
          {/* Floating particles */}
          <Particles emotion={displayEmotion} isIntense={isIntense} />
        </group>
      </Float>
    </group>
  )
}

// Eye component - 20 emotions with unique eye expressions + 自动眨眼 + 微表情
function Eye({ position, emotion, side, lookOffset = { x: 0, y: 0 } }: { position: [number, number, number]; emotion: Emotion; side: 'left' | 'right'; lookOffset?: { x: number; y: number } }) {
  const config = EYE_CONFIGS[emotion]
  const eyebrowConfig = EYEBROW_CONFIGS[emotion]
  const [isBlinking, setIsBlinking] = useState(false)
  
  // 自动眨眼动画 - 使用 BLINK_CONFIGS
  useEffect(() => {
    const blinkConfig = BLINK_CONFIGS[emotion]
    const { duration, interval, type } = blinkConfig
    
    const innerTimeoutRef = { current: 0 }
    let doubleTimeoutRef: number | null = null
    
    const doBlink = (blinkDuration: number) => {
      setIsBlinking(true)
      innerTimeoutRef.current = window.setTimeout(() => setIsBlinking(false), blinkDuration)
    }
    
    const startBlink = () => {
      doBlink(duration)
      
      if (type === 'double') {
        doubleTimeoutRef = window.setTimeout(() => {
          doBlink(duration)
        }, duration + 100)
      }
    }
    
    const timeout = setTimeout(() => {
      startBlink()
    }, Math.random() * 1000 + 500)
    
    const intervalId = setInterval(startBlink, interval)
    
    return () => {
      clearTimeout(timeout)
      clearTimeout(innerTimeoutRef.current)
      if (doubleTimeoutRef) clearTimeout(doubleTimeoutRef)
      clearInterval(intervalId)
    }
  }, [emotion])
  
  // 处理 playful 眨眼：左眼闭上，右眼睁开
  const shouldClose = config.isWink ? (side === 'left') : (config.isClosed || isBlinking)
  
  // 处理不对称眼睛（困惑、厌恶等）
  let eyeScaleX = config.eyeScale[0]
  let eyeScaleY = config.eyeScale[1]
  
  if (config.eyeShape === 'asymmetric') {
    if (emotion === 'confused') {
      // 困惑：左眼大右眼小
      eyeScaleX = side === 'left' ? 1.1 : 0.9
      eyeScaleY = side === 'left' ? 1.0 : 0.85
    } else if (emotion === 'disgusted') {
      // 厌恶：左眼更闭
      eyeScaleX = side === 'left' ? 0.9 : 1.0
      eyeScaleY = side === 'left' ? 0.75 : 0.95
    }
  }
  
  // 处理 thinking 一只眼略窄
  if (emotion === 'thinking' && side === 'left') {
    eyeScaleY = 0.9
  }
  
  // 计算眉毛旋转（支持不对称）
  let eyebrowRotation = eyebrowConfig.rotation
  if (eyebrowConfig.isAsymmetric) {
    eyebrowRotation = side === 'left' 
      ? (eyebrowConfig.leftRotation ?? eyebrowConfig.rotation)
      : (eyebrowConfig.rightRotation ?? eyebrowConfig.rotation)
  }
  
  // 眨眼时的眼睛形状
  const isSquinted = config.eyeShape === 'squinted'
  const isDroopy = config.eyeShape === 'droopy'
  const isHalfLidded = config.eyeShape === 'halfLidded'
  const isWide = config.eyeShape === 'wide'
  
  return (
    <group position={[position[0] + lookOffset.x, position[1] + lookOffset.y, position[2]]} scale={[eyeScaleX, eyeScaleY, 1]}>
      {/* Eye white */}
      <mesh>
        {shouldClose ? (
          // 闭合的眼皮 - 细长曲线
          <planeGeometry args={[0.38, 0.05]} />
        ) : isSquinted ? (
          // 笑眼 - 弯曲的弧形
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.2, 0.045, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.25} side={THREE.DoubleSide} />
          </mesh>
        ) : isHalfLidded ? (
          // 半闭眼 - 上半部分
          <sphereGeometry args={[0.22, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        ) : isWide ? (
          // 大眼
          <sphereGeometry args={[0.24, 32, 32]} />
        ) : isDroopy ? (
          // 下垂眼
          <sphereGeometry args={[0.22, 32, 32]} />
        ) : (
          // 正常眼
          <sphereGeometry args={[0.22, 32, 32]} />
        )}
        <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
      </mesh>
      
      {/* Pupil - hide when closed */}
      {!shouldClose && (
        <mesh 
          position={[config.pupilOffset[0], config.pupilOffset[1], 0.16]} 
          scale={[config.pupilScale, config.pupilScale, 1]}
        >
          <sphereGeometry args={[0.14, 32, 32]} />
          <meshStandardMaterial color="#0a0a15" />
        </mesh>
      )}
      
      {/* Highlight - hide when closed, only show sparkle for specific emotions */}
      {!shouldClose && config.hasSparkle && (
        <mesh position={[0.05, 0.05, 0.26]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
      
      {/* Regular highlight for non-sparkle emotions */}
      {!shouldClose && !config.hasSparkle && (
        <mesh position={[0.04, 0.04, 0.24]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
      
      {/* Eyebrow for expressions - hide when closed */}
      {!shouldClose && (
        <mesh 
          position={[side === 'left' ? -0.02 : 0.02, 0.35 + eyebrowConfig.verticalOffset + (1 - eyeScaleY) * 0.5, 0.28]} 
          rotation={[0, 0, eyebrowRotation]}
        >
          <planeGeometry args={[0.28, 0.06]} />
          <meshStandardMaterial color="#0a0a15" />
        </mesh>
      )}
      
      {/* Closed eye - curved line */}
      {shouldClose && (
        <mesh position={[0, 0.02, 0.01]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.35, 0.05]} />
          <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
        </mesh>
      )}
    </group>
  )
}

// Mouth component - 20 emotions with unique mouth expressions
function Mouth({ position, emotion }: { position: [number, number, number]; emotion: Emotion }) {
  const shape = MOUTH_CONFIGS[emotion]
  
  // 渲染不同的嘴巴形状
  const renderMouth = () => {
    switch (shape) {
      case 'smile':  // 微笑 - 向上弯曲的弧线（嘴角上扬）
        return (
          <mesh rotation={[Math.PI, 0, 0]}>
            <torusGeometry args={[0.22, 0.055, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      case 'bigSmile':  // 大笑 - 激动兴奋时 (哇型开口)
        return (
          <group>
            {/* ringGeometry 创建开口的圆环 (O型开口) */}
            <mesh position={[0, 0, 0.01]}>
              <ringGeometry args={[0.1, 0.2, 32]} />
              <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      
      case 'grin':  // 龇牙 - 露出牙齿（开心版本）
        return (
          <group>
            <mesh>
              <boxGeometry args={[0.35, 0.08, 0.02]} />
              <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
            </mesh>
            <mesh position={[0, -0.02, 0.01]}>
              <planeGeometry args={[0.3, 0.06]} />
              <meshStandardMaterial color="#2a2a3e" />
            </mesh>
          </group>
        )
      
      case 'frown':  // 向下弯曲
        return (
          <mesh rotation={[Math.PI, 0, 0]}>
            <torusGeometry args={[0.15, 0.05, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      case 'downturned':  // 悲伤 - happy的翻转版本，嘴角下扬
        return (
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.22, 0.055, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      case 'concerned':  // 担忧 - happy翻转但幅度小一点
        return (
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.2, 0.05, 16, 32, Math.PI * 0.8]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      case 'snarl':  // 愤怒 - 龇牙（带牙齿）
        return (
          <group>
            <mesh>
              <boxGeometry args={[0.28, 0.1, 0.02]} />
              <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
            </mesh>
            <mesh position={[0, -0.04, 0.01]}>
              <planeGeometry args={[0.24, 0.05]} />
              <meshStandardMaterial color="#2a2a3e" />
            </mesh>
          </group>
        )
      
      case 'pout':  // 愤怒收紧 - 嘴唇向前噘起
        return (
          <group>
            <mesh>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
            </mesh>
            <mesh position={[0.08, 0, 0]} scale={[0.8, 0.8, 0.8]}>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
            </mesh>
            <mesh position={[-0.08, 0, 0]} scale={[0.8, 0.8, 0.8]}>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
            </mesh>
          </group>
        )
      
      case 'wavy':  // 困惑 - 平滑的波浪曲线
        return (
          <group>
            {/* 波浪曲线 - 使用torus实现更平滑的效果 */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
              <torusGeometry args={[0.12, 0.025, 16, 32, Math.PI * 0.7]} />
              <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
            </mesh>
          </group>
        )
      
      case 'shy':  // 害羞抿嘴 - 小嘴唇
        return (
          <group scale={[1, 0.6, 1]}>
            <mesh>
              <circleGeometry args={[0.12, 32]} />
              <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
            </mesh>
          </group>
        )
      
      case 'open':  // 张大嘴 - 惊讶 (白色O形，完全闭合)
        return (
          <mesh rotation={[Math.PI, 0, 0]}>
            <torusGeometry args={[0.15, 0.04, 16, 32, Math.PI * 2]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      case 'openSmall':  // 小张嘴 - 紧张/恐惧
        return (
          <mesh>
            <circleGeometry args={[0.12, 32]} />
            <meshStandardMaterial color="#2a2a3e" />
          </mesh>
        )
      
      case 'neutral':  // 自然放松
        return (
          <mesh>
            <planeGeometry args={[0.24, 0.04]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      case 'disgust':  // 厌恶 - 不对称向下曲线（嘴角下扬）
        return (
          <group>
            <mesh position={[0.02, 0, 0]} rotation={[0, 0, 0.18]}>
              <torusGeometry args={[0.14, 0.04, 16, 32, Math.PI * 0.8]} />
              <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
            </mesh>
          </group>
        )
      
      case 'sigh':  // 无助 - 小椭圆（横向更长）
        return (
          <mesh scale={[1.3, 0.9, 1]}>
            <circleGeometry args={[0.12, 32]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      
      case 'tightFrown':  // 嫉妒 - happy翻转但更紧一点
        return (
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.18, 0.045, 16, 32, Math.PI * 0.7]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      case 'yawn':  // 困倦 - 中等圆（纵向更长）
        return (
          <mesh scale={[0.85, 1.3, 1]}>
            <circleGeometry args={[0.14, 32]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      case 'hmm':  // 思考 - 略歪向一侧
        return (
          <group>
            <mesh position={[0.03, 0, 0]} rotation={[0, 0, -0.1]}>
              <torusGeometry args={[0.1, 0.025, 16, 32, Math.PI * 0.6]} />
              <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
            </mesh>
          </group>
        )
      
      case 'warmSmile':  // 感激 - 柔和宽笑（嘴角上扬）
        return (
          <mesh rotation={[Math.PI, 0, 0]}>
            <torusGeometry args={[0.25, 0.035, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      case 'smirk':  // 自豪 - 不对称上扬（嘴角上扬，一侧更高）
        return (
          <group>
            <mesh position={[0.02, 0, 0]} rotation={[Math.PI, 0, -0.15]}>
              <torusGeometry args={[0.14, 0.035, 16, 32, Math.PI * 0.8]} />
              <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
            </mesh>
          </group>
        )
      
      case 'slightFrown':  // 怅然若失 - happy翻转但很轻微
        return (
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.15, 0.03, 16, 32, Math.PI * 0.5]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      case 'shySmile':  // 窘迫 - 小上扬（嘴角上扬）
        return (
          <mesh rotation={[Math.PI, 0, 0]}>
            <torusGeometry args={[0.12, 0.03, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      case 'tinySmile':  // 害羞 - 极小上扬（嘴角上扬）
        return (
          <mesh rotation={[Math.PI, 0, 0]}>
            <torusGeometry args={[0.08, 0.025, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
      
      default:
        return (
          <mesh>
            <planeGeometry args={[0.2, 0.03]} />
            <meshStandardMaterial color="#b8aec4" emissive="#b8aec4" emissiveIntensity={0.2} />
          </mesh>
        )
    }
  }
  
  return (
    <group position={position}>
      {renderMouth()}
    </group>
  )
}

// Cheek component - multi-color cheek support with smooth transitions
function Cheek({ position, emotion }: { position: [number, number, number]; emotion: Emotion }) {
  const config = CHEEK_CONFIGS[emotion]
  const meshRef = useRef<THREE.Mesh>(null)
  const [pulseOpacity, setPulseOpacity] = useState(0)
  
  // 高情绪强度的腮红有脉动效果
  const cheekEmotions = ['excited', 'love', 'embarrassed', 'shy', 'playful', 'happy']
  const hasCheekPulse = cheekEmotions.includes(emotion)
  
  useEffect(() => {
    if (!hasCheekPulse || config.opacity < 0.3) {
      setPulseOpacity(0)
      return
    }
    
    let startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const frequency = 2 // 慢速脉动
      const amplitude = config.opacity * 0.2
      const pulse = Math.sin(elapsed * frequency * 0.001) * amplitude
      setPulseOpacity(pulse)
    }, 16)
    
    return () => clearInterval(interval)
  }, [emotion, hasCheekPulse, config.opacity])
  
  const finalOpacity = Math.max(0, Math.min(1, config.opacity + pulseOpacity))
  
  return (
    <mesh ref={meshRef} position={position}>
      <circleGeometry args={[0.15, 32]} />
      <meshBasicMaterial 
        color={config.color} 
        transparent 
        opacity={finalOpacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// 炫彩星空粒子配置 - 每个情绪独特的星空颜色系统
const PARTICLE_COLORS: Record<string, { primary: string; secondary: string; accent: string; glow: string }> = {
  happy: { primary: '#FFD700', secondary: '#FFA500', accent: '#FFE4B5', glow: '#FFF8DC' },
  excited: { primary: '#FF6B6B', secondary: '#FF1493', accent: '#FFB6C1', glow: '#FF69B4' },
  love: { primary: '#FF69B4', secondary: '#FF1493', accent: '#FFC0CB', glow: '#FFB6C1' },
  sad: { primary: '#4169E1', secondary: '#6495ED', accent: '#87CEEB', glow: '#B0C4DE' },
  concerned: { primary: '#87CEEB', secondary: '#6495ED', accent: '#B0C4DE', glow: '#E0FFFF' },
  angry: { primary: '#FF4500', secondary: '#DC143C', accent: '#FF6347', glow: '#FF6347' },
  surprised: { primary: '#00CED1', secondary: '#40E0D0', accent: '#7FFFD4', glow: '#00FFFF' },
  fearful: { primary: '#9370DB', secondary: '#8A2BE2', accent: '#DDA0DD', glow: '#DDA0DD' },
  disgusted: { primary: '#32CD32', secondary: '#98FB98', accent: '#90EE90', glow: '#00FF00' },
  neutral: { primary: '#7C3AED', secondary: '#9370DB', accent: '#D8BFD8', glow: '#D8BFD8' },
  thinking: { primary: '#87CEEB', secondary: '#B0E0E6', accent: '#ADD8E6', glow: '#E0FFFF' },
  sleepy: { primary: '#6B5B95', secondary: '#8B7B95', accent: '#A9A9A9', glow: '#D3D3D3' },
  confused: { primary: '#FFA500', secondary: '#FFD700', accent: '#FFE4B5', glow: '#FFE4B5' },
  embarrassed: { primary: '#FFB6C1', secondary: '#FFC0CB', accent: '#FFE4E1', glow: '#FFD1DC' },
  helpless: { primary: '#708090', secondary: '#778899', accent: '#B0C4DE', glow: '#C0C0C0' },
  jealous: { primary: '#DC143C', secondary: '#B22222', accent: '#FA8072', glow: '#FF4500' },
  longing: { primary: '#8B4789', secondary: '#9370DB', accent: '#DDA0DD', glow: '#EE82EE' },
  shy: { primary: '#FF85A2', secondary: '#FF69B4', accent: '#FFB6C1', glow: '#FF69B4' },
  playful: { primary: '#20B2AA', secondary: '#48D1CC', accent: '#AFEEEE', glow: '#40E0D0' },
  proud: { primary: '#DAA520', secondary: '#FFD700', accent: '#F0E68C', glow: '#FFD700' },
  grateful: { primary: '#FF69B4', secondary: '#FFB6C1', accent: '#FFC0CB', glow: '#FFB6C1' },
}

// 眨眼配置类型
interface BlinkConfig {
  duration: number      // 眨眼持续时间 (ms)
  interval: number      // 眨眼间隔 (ms)
  type: 'normal' | 'slow' | 'double' | 'half'  // 眨眼类型
}

// 眨眼配置映射
const BLINK_CONFIGS: Record<Emotion, BlinkConfig> = {
  happy: { duration: 150, interval: 4000, type: 'normal' },
  excited: { duration: 100, interval: 2500, type: 'normal' },
  love: { duration: 200, interval: 3500, type: 'slow' },
  sad: { duration: 180, interval: 4500, type: 'normal' },
  angry: { duration: 80, interval: 5000, type: 'normal' },
  surprised: { duration: 120, interval: 3000, type: 'normal' },
  fearful: { duration: 100, interval: 2500, type: 'double' },
  disgusted: { duration: 150, interval: 4000, type: 'normal' },
  neutral: { duration: 150, interval: 4000, type: 'normal' },
  thinking: { duration: 200, interval: 4500, type: 'slow' },
  sleepy: { duration: 400, interval: 2500, type: 'slow' },
  concerned: { duration: 150, interval: 3500, type: 'normal' },
  confused: { duration: 150, interval: 4000, type: 'double' },
  embarrassed: { duration: 100, interval: 2000, type: 'normal' },
  helpless: { duration: 200, interval: 4500, type: 'slow' },
  jealous: { duration: 100, interval: 4000, type: 'normal' },
  longing: { duration: 200, interval: 4500, type: 'slow' },
  shy: { duration: 80, interval: 2500, type: 'half' },
  playful: { duration: 150, interval: 3000, type: 'double' },
  proud: { duration: 150, interval: 4000, type: 'normal' },
  grateful: { duration: 200, interval: 3500, type: 'slow' },
}

// 星空 Particles component
function Particles({ emotion, isIntense }: { emotion: Emotion; isIntense: boolean }) {
  const particlesRef = useRef<THREE.Points>(null)
  const geometryRef = useRef<THREE.BufferGeometry>(null)
  
  const colors = PARTICLE_COLORS[emotion] || PARTICLE_COLORS.neutral
  const count = isIntense ? 100 : 60
  
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 2 + Math.random() * 0.5
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi)
    }
    return arr
  }, [count])
  
  const colorsArray = useMemo(() => {
    const arr = new Float32Array(count * 3)
    const { primary, secondary, accent } = colors
    for (let i = 0; i < count; i++) {
      const colorChoice = Math.random()
      let color: THREE.Color
      
      if (colorChoice < 0.4) {
        color = new THREE.Color(primary)
      } else if (colorChoice < 0.7) {
        color = new THREE.Color(secondary)
      } else {
        color = new THREE.Color(accent)
      }
      
      arr[i * 3] = color.r
      arr[i * 3 + 1] = color.g
      arr[i * 3 + 2] = color.b
    }
    return arr
  }, [count, colors.primary, colors.secondary, colors.accent])
  
  useEffect(() => {
    if (!particlesRef.current || !geometryRef.current) return
    
    const speed = isIntense ? 0.008 : 0.002
    let animationId: number
    
    const animate = () => {
      if (!particlesRef.current) return
      particlesRef.current.rotation.y += speed
      particlesRef.current.rotation.x += speed * 0.5
      animationId = requestAnimationFrame(animate)
    }
    
    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [isIntense])
  
  const particleSize = isIntense ? 0.12 : 0.08
  const particleOpacity = isIntense ? 1.0 : 0.8
  
  return (
    <points ref={particlesRef} key={emotion}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={colorsArray}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={particleSize}
        vertexColors={true}
        transparent
        opacity={particleOpacity}
        sizeAttenuation
        blending={THREE.NormalBlending}
        depthWrite={false}
      />
    </points>
  )
}

// 情绪名称映射
const EMOTION_NAMES: Record<Emotion, string> = {
  happy: '开心',
  excited: '兴奋',
  love: '喜爱',
  sad: '悲伤',
  concerned: '担忧',
  angry: '愤怒',
  surprised: '惊讶',
  fearful: '恐惧',
  disgusted: '厌恶',
  neutral: '平静',
  thinking: '思考',
  sleepy: '困倦',
  confused: '困惑',
  embarrassed: '窘迫',
  helpless: '无奈',
  jealous: '吃醋',
  longing: '怅然若失',
  shy: '害羞',
  playful: '调皮',
  proud: '自豪',
  grateful: '感激',
}

// Emotion Label component
function EmotionLabel({ emotion }: { emotion: Emotion }) {
  const name = EMOTION_NAMES[emotion] || emotion
  const color = EMOTION_COLORS[emotion] || '#7C3AED'
  
  return (
    <div 
      className="emotion-label"
      style={{ 
        borderColor: color,
        color: color,
        backgroundColor: `rgba(255,255,255,0.85)`,
        backdropFilter: 'blur(8px)'
      }}
    >
      {name}
    </div>
  )
}

// Main Avatar Canvas component
export default function AvatarCanvas() {
  const storeDisplayEmotion = useChatStore((state) => state.displayEmotion) || 'neutral'
  
  return (
    <div className="avatar-canvas">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
        }}
      >
        <Suspense fallback={
          <mesh>
            <sphereGeometry args={[1, 32, 32]} />
            <meshStandardMaterial color="#7C3AED" wireframe />
          </mesh>
        }>
          {/* Lighting */}
          <ambientLight intensity={0.4} />
          <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#7C3AED" />
          <spotLight
            position={[0, 10, 0]}
            intensity={0.5}
            angle={0.5}
            penumbra={1}
            color="#A78BFA"
          />
          
          {/* Aurora Avatar */}
          <AuroraAvatar />
          
          {/* Controls */}
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.5}
          />
        </Suspense>
      </Canvas>
      <EmotionLabel emotion={storeDisplayEmotion} />
    </div>
  )
}
