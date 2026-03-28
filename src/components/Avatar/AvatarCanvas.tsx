import { Canvas } from '@react-three/fiber'
import { OrbitControls, Float } from '@react-three/drei'
import { Suspense, useRef, useEffect, useState } from 'react'
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
  excited: '#FF6B6B',    // 红色
  love: '#FF69B4',       // 粉色
  sad: '#4169E1',        // 蓝色
  angry: '#FF4500',      // 橙红色
  surprised: '#00CED1',  // 青色
  fearful: '#9370DB',    // 紫色
  disgusted: '#32CD32', // 绿色
  neutral: '#7C3AED',    // 紫罗兰
  thinking: '#87CEEB',   // 天蓝色
  sleepy: '#6B5B95',     // 深紫色（更暗，让眼睛和嘴巴更明显）
  confused: '#FFA500',   // 橙色
  embarrassed: '#FFB6C1',// 浅粉色
  helpless: '#708090',   // 石板灰
  jealous: '#DC143C',    // 深红色
  longing: '#8B4789',   // 中紫红色
  shy: '#FF85A2',        // 亮粉色
  playful: '#20B2AA',    // 浅海绿
  proud: '#DAA520',      // 金麒麟色
  grateful: '#FF69B4',   // 粉色（与love相同但可接受）
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
}

// 眼睛配置映射 - 20 种情绪各有独特的眼睛
const EYE_CONFIGS: Record<Emotion, EyeConfig> = {
  // 开心 - 轻微笑眼 (happy crescent)
  happy: {
    eyeScale: [1.0, 0.85],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'squinted'
  },
  // 兴奋 - 睁大 + 高光
  excited: {
    eyeScale: [1.3, 1.3],
    pupilScale: 1.3,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: false,
    eyeShape: 'wide'
  },
  // 爱 - 半闭眼 + 高光
  love: {
    eyeScale: [1.0, 0.8],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: false,
    eyeShape: 'halfLidded'
  },
  // 悲伤 - 下垂 + 瞳孔变小
  sad: {
    eyeScale: [1.0, 0.95],
    pupilScale: 0.85,
    pupilOffset: [0, -0.02],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'droopy'
  },
  // 担忧 - 轻微眯眼 + 略微下垂
  concerned: {
    eyeScale: [1.0, 0.85],
    pupilScale: 0.9,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'normal'
  },
  // 愤怒 - 眯起 + 尖锐
  angry: {
    eyeScale: [1.0, 0.7],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'narrowed'
  },
  // 惊讶 - 非常睁大 + 大瞳孔
  surprised: {
    eyeScale: [1.4, 1.4],
    pupilScale: 1.3,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: false,
    eyeShape: 'wide'
  },
  // 恐惧 - 睁大 + 小瞳孔
  fearful: {
    eyeScale: [1.2, 1.2],
    pupilScale: 0.7,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'wide'
  },
  // 厌恶 - 不对称眯眼
  disgusted: {
    eyeScale: [0.95, 0.85],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'asymmetric'
  },
  // 中性 - 正常放松
  neutral: {
    eyeScale: [1.0, 1.0],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'normal'
  },
  // 思考 - 向上看 + 一只眼略窄
  thinking: {
    eyeScale: [1.0, 0.95],
    pupilScale: 1.0,
    pupilOffset: [0, 0.05],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'normal'
  },
  // 困倦 - 几乎闭上
  sleepy: {
    eyeScale: [1.0, 0.15],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: true,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'droopy'
  },
  // 困惑 - 不对称大小
  confused: {
    eyeScale: [1.1, 1.0],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'asymmetric'
  },
  // 窘迫 - 目光躲避 + 半闭
  embarrassed: {
    eyeScale: [1.0, 0.85],
    pupilScale: 1.0,
    pupilOffset: [-0.04, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'halfLidded'
  },
  // 无助 - 柔和下垂
  helpless: {
    eyeScale: [1.0, 0.95],
    pupilScale: 1.0,
    pupilOffset: [0, -0.02],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'droopy'
  },
  // 嫉妒 - 斜眼 + 眯眼
  jealous: {
    eyeScale: [0.9, 0.8],
    pupilScale: 1.0,
    pupilOffset: [0.06, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'narrowed'
  },
  // 怅然若失 - 轻微下垂 + 远望
  longing: {
    eyeScale: [1.0, 0.9],
    pupilScale: 0.9,
    pupilOffset: [0, 0.03],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'droopy'
  },
  // 害羞 - 目光躲避 + 半闭
  shy: {
    eyeScale: [1.0, 0.8],
    pupilScale: 1.0,
    pupilOffset: [-0.05, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'halfLidded'
  },
  // 调皮 - 眨眼 (左眼闭，右眼开)
  playful: {
    eyeScale: [1.0, 1.0],
    pupilScale: 1.2,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: true,  // 特殊标记，左眼眨眼
    eyeShape: 'normal'
  },
  // 自豪 - 轻微闭眼
  proud: {
    eyeScale: [1.0, 0.85],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: false,
    isWink: false,
    eyeShape: 'squinted'
  },
  // 感激 - 柔和温暖
  grateful: {
    eyeScale: [1.0, 0.9],
    pupilScale: 1.0,
    pupilOffset: [0, 0],
    isClosed: false,
    hasSparkle: true,
    isWink: false,
    eyeShape: 'halfLidded'
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

// 眉毛配置映射 - 每个情绪独特的眉毛
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
    rotation: 0.2,
    verticalOffset: 0,
    isAsymmetric: false
  },
  // 担忧 - 轻微皱起（担忧的眉毛）
  concerned: {
    rotation: 0.1,
    verticalOffset: 0.02,
    isAsymmetric: false
  },
  // 愤怒 - V 形下沉
  angry: {
    rotation: 0.4,
    verticalOffset: -0.05,
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
  // 厌恶 - 不对称皱眉
  disgusted: {
    rotation: 0.1,
    verticalOffset: 0,
    isAsymmetric: true,
    leftRotation: 0.25,
    rightRotation: 0.1
  },
  // 中性 - 平板
  neutral: {
    rotation: 0,
    verticalOffset: 0,
    isAsymmetric: false
  },
  // 思考 - 一侧抬起
  thinking: {
    rotation: 0,
    verticalOffset: 0,
    isAsymmetric: true,
    leftRotation: -0.2,
    rightRotation: 0
  },
  // 困倦 - 下垂
  sleepy: {
    rotation: 0.1,
    verticalOffset: -0.05,
    isAsymmetric: false
  },
  // 困惑 - 不对称
  confused: {
    rotation: 0,
    verticalOffset: 0,
    isAsymmetric: true,
    leftRotation: -0.25,
    rightRotation: 0.05
  },
  // 窘迫 - 略抬
  embarrassed: {
    rotation: -0.1,
    verticalOffset: 0,
    isAsymmetric: false
  },
  // 无助 - 轻微内抬
  helpless: {
    rotation: -0.05,
    verticalOffset: 0.03,
    isAsymmetric: false
  },
  // 嫉妒 - 不对称一下沉
  jealous: {
    rotation: 0,
    verticalOffset: 0,
    isAsymmetric: true,
    leftRotation: 0.15,
    rightRotation: -0.1
  },
  // 怅然若失 - 柔和拱形
  longing: {
    rotation: -0.1,
    verticalOffset: 0,
    isAsymmetric: false
  },
  // 害羞 - 轻锁
  shy: {
    rotation: -0.08,
    verticalOffset: 0,
    isAsymmetric: false
  },
  // 调皮 - 不对称
  playful: {
    rotation: 0,
    verticalOffset: 0,
    isAsymmetric: true,
    leftRotation: -0.3,
    rightRotation: 0.05
  },
  // 自豪 - 略抬
  proud: {
    rotation: -0.15,
    verticalOffset: 0.04,
    isAsymmetric: false
  },
  // 感激 - 柔和拱形
  grateful: {
    rotation: -0.12,
    verticalOffset: 0,
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
  angry: 'snarl',        // 愤怒用 snarl
  surprised: 'open',
  fearful: 'openSmall',
  disgusted: 'disgust',
  neutral: 'neutral',
  thinking: 'hmm',
  sleepy: 'yawn',
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
  
  // Animate color based on emotion
  useEffect(() => {
    if (!meshRef.current) return
    
    const material = meshRef.current.material as THREE.MeshStandardMaterial
    const color = new THREE.Color(targetColor)
    
    // Smooth color transition
    const lerpFactor = isIntense ? 0.15 : 0.05
    const animateColor = () => {
      material.color.lerp(color, lerpFactor)
      material.emissive.lerp(color, lerpFactor)
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
  
  // Pulse effect for intense emotions
  useEffect(() => {
    if (!isIntense && !isLoading) {
      setPulseScale(1)
      return
    }
    
    let startTime = Date.now()
    const pulseInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const frequency = displayEmotion === 'excited' ? 8 : 4
      const amplitude = displayEmotion === 'excited' ? 0.15 : 0.08
      const scale = 1 + Math.sin(elapsed * frequency * 0.001) * amplitude
      setPulseScale(scale)
    }, 16)
    
    return () => clearInterval(pulseInterval)
  }, [displayEmotion, isIntense, isLoading])
  
  // Calculate scale with pulse effect
  const baseScale = isLoading ? 1.05 : 1
  const finalScale = baseScale * pulseScale

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
              opacity={0.9}
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
          <Eye position={[-0.4, 0.2, 1.2]} emotion={displayEmotion} side="left" />
          <Eye position={[0.4, 0.2, 1.2]} emotion={displayEmotion} side="right" />
          
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

// Eye component - 20 emotions with unique eye expressions
function Eye({ position, emotion, side }: { position: [number, number, number]; emotion: Emotion; side: 'left' | 'right' }) {
  const config = EYE_CONFIGS[emotion]
  const eyebrowConfig = EYEBROW_CONFIGS[emotion]
  
  // 处理 playful 眨眼：左眼闭上，右眼睁开
  const shouldClose = config.isWink ? (side === 'left') : config.isClosed
  
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
    <group position={position} scale={[eyeScaleX, eyeScaleY, 1]}>
      {/* Eye white */}
      <mesh>
        {shouldClose ? (
          // 闭合的眼皮 - 细长曲线
          <planeGeometry args={[0.38, 0.05]} />
        ) : isSquinted ? (
          // 笑眼 - 弯曲的弧形
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.2, 0.035, 8, 16, Math.PI]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} side={THREE.DoubleSide} />
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
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
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
          position={[side === 'left' ? -0.02 : 0.02, 0.32 + eyebrowConfig.verticalOffset, 0.12]} 
          rotation={[0, 0, eyebrowRotation]}
        >
          <planeGeometry args={[0.28, 0.055]} />
          <meshStandardMaterial color="#0a0a15" />
        </mesh>
      )}
      
      {/* Closed eye - curved line */}
      {shouldClose && (
        <mesh position={[0, 0.02, 0.01]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.35, 0.05]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
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
            <torusGeometry args={[0.22, 0.045, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      case 'bigSmile':  // 大笑 - 激动兴奋时 (哇型开口)
        return (
          <group>
            {/* ringGeometry 创建开口的圆环 (O型开口) */}
            <mesh position={[0, 0, 0.01]}>
              <ringGeometry args={[0.1, 0.2, 32]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      
      case 'grin':  // 龇牙 - 露出牙齿（开心版本）
        return (
          <group>
            <mesh>
              <boxGeometry args={[0.35, 0.08, 0.02]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
            </mesh>
            <mesh position={[0, -0.02, 0.01]}>
              <planeGeometry args={[0.3, 0.06]} />
              <meshStandardMaterial color="#1a1a2e" />
            </mesh>
          </group>
        )
      
      case 'frown':  // 向下弯曲
        return (
          <mesh rotation={[Math.PI, 0, 0]}>
            <torusGeometry args={[0.15, 0.04, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      case 'downturned':  // 悲伤 - happy的翻转版本，嘴角下扬
        return (
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.22, 0.045, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      case 'concerned':  // 担忧 - happy翻转但幅度小一点
        return (
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.2, 0.04, 16, 32, Math.PI * 0.8]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      case 'snarl':  // 愤怒 - 龇牙（带牙齿）
        return (
          <group>
            <mesh>
              <boxGeometry args={[0.28, 0.1, 0.02]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
            </mesh>
            <mesh position={[0, -0.04, 0.01]}>
              <planeGeometry args={[0.24, 0.05]} />
              <meshStandardMaterial color="#1a1a2e" />
            </mesh>
          </group>
        )
      
      case 'pout':  // 愤怒收紧 - 嘴唇向前噘起
        return (
          <group>
            <mesh>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
            </mesh>
            <mesh position={[0.08, 0, 0]} scale={[0.8, 0.8, 0.8]}>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
            </mesh>
            <mesh position={[-0.08, 0, 0]} scale={[0.8, 0.8, 0.8]}>
              <sphereGeometry args={[0.1, 16, 16]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
            </mesh>
          </group>
        )
      
      case 'wavy':  // 困惑 - 平滑的波浪曲线
        return (
          <group>
            {/* 波浪曲线 - 使用torus实现更平滑的效果 */}
            <mesh position={[0, 0, 0]} rotation={[0, 0, 0]}>
              <torusGeometry args={[0.12, 0.025, 16, 32, Math.PI * 0.7]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
            </mesh>
          </group>
        )
      
      case 'shy':  // 害羞抿嘴 - 小嘴唇
        return (
          <group scale={[1, 0.6, 1]}>
            <mesh>
              <circleGeometry args={[0.12, 32]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
            </mesh>
          </group>
        )
      
      case 'open':  // 张大嘴 - 惊讶 (白色O形，完全闭合)
        return (
          <mesh rotation={[Math.PI, 0, 0]}>
            <torusGeometry args={[0.15, 0.04, 16, 32, Math.PI * 2]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      case 'openSmall':  // 小张嘴 - 紧张/恐惧
        return (
          <mesh>
            <circleGeometry args={[0.12, 32]} />
            <meshStandardMaterial color="#1a1a2e" />
          </mesh>
        )
      
      case 'neutral':  // 自然放松
        return (
          <mesh>
            <planeGeometry args={[0.24, 0.04]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      case 'disgust':  // 厌恶 - 不对称向下曲线（嘴角下扬）
        return (
          <group>
            <mesh position={[0.02, 0, 0]} rotation={[0, 0, 0.18]}>
              <torusGeometry args={[0.14, 0.04, 16, 32, Math.PI * 0.8]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
            </mesh>
          </group>
        )
      
      case 'sigh':  // 无助 - 小椭圆（横向更长）
        return (
          <mesh scale={[1.3, 0.9, 1]}>
            <circleGeometry args={[0.12, 32]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      
      case 'tightFrown':  // 嫉妒 - happy翻转但更紧一点
        return (
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.18, 0.045, 16, 32, Math.PI * 0.7]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      case 'yawn':  // 困倦 - 中等圆（纵向更长）
        return (
          <mesh scale={[0.85, 1.3, 1]}>
            <circleGeometry args={[0.14, 32]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      case 'hmm':  // 思考 - 略歪向一侧
        return (
          <group>
            <mesh position={[0.03, 0, 0]} rotation={[0, 0, -0.1]}>
              <torusGeometry args={[0.1, 0.025, 16, 32, Math.PI * 0.6]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
            </mesh>
          </group>
        )
      
      case 'warmSmile':  // 感激 - 柔和宽笑（嘴角上扬）
        return (
          <mesh rotation={[Math.PI, 0, 0]}>
            <torusGeometry args={[0.25, 0.035, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      case 'smirk':  // 自豪 - 不对称上扬（嘴角上扬，一侧更高）
        return (
          <group>
            <mesh position={[0.02, 0, 0]} rotation={[Math.PI, 0, -0.15]}>
              <torusGeometry args={[0.14, 0.035, 16, 32, Math.PI * 0.8]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
            </mesh>
          </group>
        )
      
      case 'slightFrown':  // 怅然若失 - happy翻转但很轻微
        return (
          <mesh rotation={[0, 0, 0]}>
            <torusGeometry args={[0.15, 0.03, 16, 32, Math.PI * 0.5]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      case 'shySmile':  // 窘迫 - 小上扬（嘴角上扬）
        return (
          <mesh rotation={[Math.PI, 0, 0]}>
            <torusGeometry args={[0.12, 0.03, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      case 'tinySmile':  // 害羞 - 极小上扬（嘴角上扬）
        return (
          <mesh rotation={[Math.PI, 0, 0]}>
            <torusGeometry args={[0.08, 0.025, 16, 32, Math.PI]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
          </mesh>
        )
      
      default:
        return (
          <mesh>
            <planeGeometry args={[0.2, 0.03]} />
            <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
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

// Cheek component - multi-color cheek support
function Cheek({ position, emotion }: { position: [number, number, number]; emotion: Emotion }) {
  const config = CHEEK_CONFIGS[emotion]
  
  return (
    <mesh position={position}>
      <circleGeometry args={[0.15, 32]} />
      <meshBasicMaterial 
        color={config.color} 
        transparent 
        opacity={config.opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// Particles component
function Particles({ emotion, isIntense }: { emotion: Emotion; isIntense: boolean }) {
  const particlesRef = useRef<THREE.Points>(null)
  
  const count = 50
  const positions = new Float32Array(count * 3)
  
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 2 + Math.random() * 0.5
    
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
    positions[i * 3 + 2] = r * Math.cos(phi)
  }
  
  useEffect(() => {
    if (!particlesRef.current) return
    
    // Faster rotation for intense emotions
    const speed = isIntense ? 0.008 : 0.002
    const animate = () => {
      if (!particlesRef.current) return
      particlesRef.current.rotation.y += speed
      particlesRef.current.rotation.x += speed * 0.5
    }
    
    const interval = setInterval(animate, 16)
    return () => clearInterval(interval)
  }, [isIntense])
  
  // Color based on emotion
  const color = EMOTION_COLORS[emotion] || '#7C3AED'
  
  // More particles and larger size for intense emotions
  const particleSize = isIntense ? 0.08 : 0.05
  const particleOpacity = isIntense ? 0.9 : 0.6
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={particleSize}
        color={color}
        transparent
        opacity={particleOpacity}
        sizeAttenuation
      />
    </points>
  )
}

// Main Avatar Canvas component
export default function AvatarCanvas() {
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
    </div>
  )
}
