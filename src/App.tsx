import { useState, useEffect, useRef, Component, ReactNode } from 'react'
import AvatarCanvas from './components/Avatar/AvatarCanvas'
import Chat from './components/Chat/Chat'
import Settings from './components/Settings/Settings'
import { useChatStore } from './stores/chatStore'
import './App.css'

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%', 
          color: '#fff',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <span style={{ fontSize: '48px' }}>😵</span>
          <span>Something went wrong</span>
          <button 
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: '8px 16px',
              background: '#7c3aed',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Storage key for cross-tab sync
const STORAGE_KEY = 'aiAurora_settings'
const SPLIT_RATIO_KEY = 'aiAurora_splitRatio'

function App() {
  const [showSettings, setShowSettings] = useState(false)
  const { settings, setSettings, setCurrentEmotion } = useChatStore()
  
  // Split panel state
  const [splitRatio, setSplitRatio] = useState(() => {
    const saved = localStorage.getItem(SPLIT_RATIO_KEY)
    return saved ? parseFloat(saved) : 0.5
  })
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Settings are now loaded synchronously at store creation time from localStorage
  // This useEffect is only for catching any updates that might have happened
  // in other browser tabs (storage event)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const stored = JSON.parse(e.newValue)
          setSettings(stored as any)
        } catch {}
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [setSettings])
  
  // Save split ratio to localStorage
  useEffect(() => {
    localStorage.setItem(SPLIT_RATIO_KEY, splitRatio.toString())
  }, [splitRatio])
  
  // Handle mouse move for drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return
      
      const container = containerRef.current
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const newRatio = Math.max(0.25, Math.min(0.75, x / rect.width))
      setSplitRatio(newRatio)
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    
    if (isDragging) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])
  
  // Welcome emotion animation
  useEffect(() => {
    const emotions: Array<'happy' | 'excited' | 'love'> = ['happy', 'excited', 'love']
    let index = 0
    
    const interval = setInterval(() => {
      setCurrentEmotion(emotions[index])
      index = (index + 1) % emotions.length
    }, 2000)
    
    // Reset to happy after welcome
    setTimeout(() => {
      clearInterval(interval)
      setCurrentEmotion('happy')
    }, 6000)
    
    return () => clearInterval(interval)
  }, [setCurrentEmotion])
  
  const handleDragStart = () => {
    setIsDragging(true)
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="logo">
          <span className="logo-icon">✨</span>
          <span className="logo-text">aiAurora</span>
        </div>
        
        <div className="header-status">
          <span className="status-dot"></span>
          <span className="status-text">
            {settings.apiProvider === 'ollama' ? 'Local' : 'Online'}
          </span>
        </div>
        
        <button 
          className="settings-btn"
          onClick={() => setShowSettings(true)}
        >
          ⚙️
        </button>
      </header>
      
      {/* Main content */}
      <main className="app-main" ref={containerRef}>
        {/* Avatar panel */}
        <div className="avatar-panel" style={{ width: `${splitRatio * 100}%` }}>
          <ErrorBoundary fallback={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff' }}>
              Loading avatar...
            </div>
          }>
            <AvatarCanvas />
          </ErrorBoundary>
        </div>
        
        {/* Drag handle */}
        <div 
          className={`split-handle ${isDragging ? 'dragging' : ''}`}
          onMouseDown={handleDragStart}
        >
          <div className="split-handle-line"></div>
        </div>
        
        {/* Chat panel */}
        <div className="chat-panel" style={{ width: `${(1 - splitRatio) * 100}%` }}>
          <ErrorBoundary>
            <Chat />
          </ErrorBoundary>
        </div>
      </main>
      
      {/* Settings modal */}
      {showSettings && (
        <Settings onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

export default App
