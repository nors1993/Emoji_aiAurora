const fs = require('fs');
const content = `import { Canvas } from '@react-three/fiber'
import { OrbitControls, Float } from '@react-three/drei'
import { Suspense, useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { useChatStore } from '../../stores/chatStore'
import { Emotion } from '../../types'
import './Avatar.css'

// 只有愤怒情绪才会触发抖动
const ANGRY_SHAKE_EMOTIONS = ['angry']

// 高强度情绪（触发脉动效果）
const INTENSE_EMOTIONS = ['excited', 'happy', 'love', 'angry', 'proud', 'playful']

// 情绪 -> 颜色映射
const EMOTION_COLORS: Record<string, string> = {
  happy: '#FFD700',
  excited: '#FF6B6B',
  love: '#FF69B4',
  sad: '#4169E1',
  angry: '#FF4500',
  surprised: '#00CED1',
  fearful: '#9370DB',
  disgusted: '#32CD32',
  neutral: '#7C3AED',
  thinking: '#87CEEB',
  sleepy: '#DDA0DD',
  confused: '#FFA500',
  embarrassed: '#FFB6C1',
  helpless: '#708090',
  jealous: '#DC143C',
  longing: '#8B4789',
  shy: '#FF85A2',
  playful: '#20B2AA',
  proud: '#DAA520',
  grateful: '#FF69B4',
}

function AuroraAvatar() {
  const meshRef = useRef<THREE.Mesh>(null)
  const groupRef = useRef<THREE.Group>(null)
  const currentEmotion = useChatStore((state) => state.currentEmotion) || 'happy'
  const isSpeaking = useChatStore((state) => state.isSpeaking) || false
  
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 })
  const [pulseScale, setPulseScale] = useState(1)
  
  const isIntense = INTENSE_EMOTIONS.includes(currentEmotion)
  const targetColor = EMOTION_COLORS[currentEmotion] || '#7C3AED'
  
  useEffect(() => {
    if (!meshRef.current) return
    const material = meshRef.current.material as THREE.MeshStandardMaterial
    const color = new THREE.Color(targetColor)
    const lerpFactor = isIntense ? 0.15 : 0.05
    const animateColor = () => {
      material.color.lerp(color, lerpFactor)
      material.emissive.lerp(color, lerpFactor)
    }
    const interval = setInterval(animateColor, 16)
    return () => clearInterval(interval)
  }, [currentEmotion, isIntense, targetColor])
  
  const isAngry = ANGRY_SHAKE_EMOTIONS.includes(currentEmotion)
  
  useEffect(() => {
    if (!isAngry) { setShakeOffset({ x: 0, y: 0 }); return }
    const shakeInterval = setInterval(() => {
      const intensity = 0.15
      setShakeOffset({ x: (Math.random() - 0.5) * intensity, y: (Math.random() - 0.5) * intensity })
    }, 50)
    return () => clearInterval(shakeInterval)
  }, [currentEmotion, isAngry])
  
  useEffect(() => {
    if (!isIntense && !isSpeaking) { setPulseScale(1); return }
    let startTime = Date.now()
    const pulseInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const frequency = currentEmotion === 'excited' ? 8 : 4
      const amplitude = currentEmotion === 'excited' ? 0.15 : 0.08
      setPulseScale(1 + Math.sin(elapsed * frequency * 0.001) * amplitude)
    }, 16)
    return () => clearInterval(pulseInterval)
  }, [currentEmotion, isIntense, isSpeaking])
  
  const baseScale = isSpeaking ? 1.05 : 1
  const finalScale = baseScale * pulseScale

  return (
    <group ref={groupRef} position={[shakeOffset.x, shakeOffset.y, 0]}>
      <Float speed={isIntense ? 4 : 2} rotationIntensity={isIntense ? 1 : 0.5} floatIntensity={isIntense ? 1.5 : 0.5}>
        <group scale={[finalScale, finalScale, finalScale]}>
          <mesh ref={meshRef} castShadow>
            <sphereGeometry args={[1.5, 64, 64]} />
            <meshStandardMaterial color={targetColor} emissive={targetColor} emissiveIntensity={isIntense ? 0.6 : 0.3} metalness={0.2} roughness={0.3} transparent opacity={0.9} />
          </mesh>
          <mesh scale={[1.2, 1.2, 1.2]}>
            <sphereGeometry args={[1.5, 32, 32]} />
            <meshBasicMaterial color={targetColor} transparent opacity={isIntense ? 0.4 : 0.2} side={THREE.BackSide} />
          </mesh>
          {isIntense && (
            <mesh scale={[1.8, 1.8, 1.8]}>
              <sphereGeometry args={[1.5, 32, 32]} />
              <meshBasicMaterial color={targetColor} transparent opacity={0.15} side={THREE.BackSide} />
            </mesh>
          )}
          <Eye position={[-0.4, 0.2, 1.2]} emotion={currentEmotion} />
          <Eye position={[0.4, 0.2, 1.2]} emotion={currentEmotion} />
          <Mouth position={[0, -0.3, 1.3]} emotion={currentEmotion} />
          <Cheek position={[-0.7, -0.1, 1]} emotion={currentEmotion} />
          <Cheek position={[0.7, -0.1, 1]} emotion={currentEmotion} />
          <Particles emotion={currentEmotion} isIntense={isIntense} />
        </group>
      </Float>
    </group>
  )
}

function Eye({ position, emotion }: { position: [number, number, number]; emotion: Emotion }) {
  const isClosed = emotion === 'sleepy' || emotion === 'thinking'
  const isSurprised = emotion === 'surprised'
  const isAngry = emotion === 'angry'
  return (
    <group position={position}>
      <mesh>{isClosed ? (<planeGeometry args={[0.35, 0.05]} />) : (<sphereGeometry args={[0.2, 32, 32]} />)}<meshStandardMaterial color="#ffffff" /></mesh>
      {!isClosed && (<mesh position={[0, 0, 0.15]}><sphereGeometry args={[0.12, 32, 32]} /><meshStandardMaterial color="#1a1a2e" /></mesh>)}
      {!isClosed && (<mesh position={[0.04, 0.04, 0.25]}><sphereGeometry args={[0.04, 16, 16]} /><meshBasicMaterial color="#ffffff" /></mesh>)}
      {!isClosed && (<mesh position={[0, 0.3, 0]} rotation={[0, 0, isAngry ? 0.3 : isSurprised ? -0.3 : 0]}><planeGeometry args={[0.3, 0.04]} /><meshStandardMaterial color="#7C3AED" /></mesh>)}
    </group>
  )
}

// Mouth component - FIXED: 正确的情绪->嘴巴形状映射
function Mouth({ position, emotion }: { position: [number, number, number]; emotion: Emotion }) {
  type MouthShape = 'smile' | 'bigSmile' | 'grin' | 'frown' | 'open' | 'neutral' | 'pout' | 'wavy' | 'shy'
  let shape: MouthShape = 'neutral'
  
  switch (emotion) {
    case 'happy': shape = 'smile'; break
    case 'excited': shape = 'bigSmile'; break  // 兴奋-大笑
    case 'love': shape = 'smile'; break
    case 'sad': shape = 'frown'; break
    case 'angry': shape = 'pout'; break  // 愤怒-嘴巴翘起，不是frown!
    case 'surprised': shape = 'open'; break
    case 'disgusted': shape = 'open'; break
    case 'fearful': shape = 'open'; break  // 恐惧-张嘴
    case 'neutral': case 'thinking': case 'sleepy': shape = 'neutral'; break
    case 'embarrassed': case 'shy': shape = 'shy'; break  // 害羞
    case 'playful': shape = 'grin'; break  // 调皮-露齿笑
    case 'grateful': shape = 'smile'; break
    case 'proud': shape = 'bigSmile'; break  // 自豪-大笑
    case 'confused': case 'helpless': case 'jealous': shape = 'wavy'; break  // 不确定
    case 'longing': shape = 'frown'; break  // 怅然
    default: shape = 'neutral'
  }
  
  return (
    <group position={position}>
      {shape === 'smile' && (<mesh><torusGeometry args={[0.2, 0.04, 16, 32, Math.PI]} /><meshStandardMaterial color="#1a1a2e" /></mesh>)}
      {shape === 'bigSmile' && (<mesh><torusGeometry args={[0.25, 0.05, 16, 32, Math.PI]} /><meshStandardMaterial color="#1a1a2e" /></mesh>)}
      {shape === 'grin' && (<group><mesh><torusGeometry args={[0.22, 0.05, 16, 32, Math.PI]} /><meshStandardMaterial color="#1a1a2e" /></mesh><mesh position={[0, 0.02, 0.02]}><planeGeometry args={[0.15, 0.06]} /><meshBasicMaterial color="#ffffff" /></mesh></group>)}
      {shape === 'frown' && (<mesh rotation={[Math.PI, 0, 0]}><torusGeometry args={[0.15, 0.04, 16, 32, Math.PI]} /><meshStandardMaterial color="#1a1a2e" /></mesh>)}
      {shape === 'open' && (<mesh><circleGeometry args={[0.15, 32]} /><meshStandardMaterial color="#1a1a2e" /></mesh>)}
      {shape === 'neutral' && (<mesh><planeGeometry args={[0.2, 0.03]} /><meshStandardMaterial color="#1a1a2e" /></mesh>)}
      {shape === 'pout' && (<mesh rotation={[0, 0, 0]}><torusGeometry args={[0.12, 0.03, 16, 32, Math.PI * 0.6]} /><meshStandardMaterial color="#1a1a2e" /></mesh>)}
      {shape === 'wavy' && (<mesh rotation={[0, 0, 0]}><torusGeometry args={[0.15, 0.025, 8, 32, Math.PI * 0.8]} /><meshStandardMaterial color="#1a1a2e" /></mesh>)}
      {shape === 'shy' && (<mesh><torusGeometry args={[0.12, 0.03, 16, 32, Math.PI]} /><meshStandardMaterial color="#1a1a2e" /></me
