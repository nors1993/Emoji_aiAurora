import { useState, useEffect } from 'react'
import { useChatStore } from '../../stores/chatStore'
import { checkOllamaConnection, getOllamaModels } from '../../utils/llm'
import { PERSONALITY_PROMPTS, type Settings } from '../../types'
import './Settings.css'

interface SettingsProps {
  onClose: () => void
}

// LocalStorage key
const STORAGE_KEY = 'aiAurora_settings'
const PERSONALITY_KEY = 'aiAurora_personality'

// Load from localStorage
function loadFromStorage(): Record<string, unknown> | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

function loadPersonalityFromStorage(): string {
  try {
    return localStorage.getItem(PERSONALITY_KEY) || 'default'
  } catch {
    return 'default'
  }
}

// Save to localStorage
function saveToStorage(settings: Record<string, unknown>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

function savePersonalityToStorage(personality: string) {
  try {
    localStorage.setItem(PERSONALITY_KEY, personality)
  } catch (e) {
    console.error('Failed to save personality to localStorage:', e)
  }
}

// Fetch models from OpenAI compatible API
async function fetchOpenAIModels(apiUrl: string, apiKey: string): Promise<string[]> {
  if (!apiUrl || !apiKey) return []
  
  try {
    const response = await fetch(`${apiUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      console.error('Failed to fetch models:', response.status)
      return []
    }
    
    const data = await response.json()
    return data.data?.map((m: { id: string }) => m.id) || []
  } catch (error) {
    console.error('Error fetching models:', error)
    return []
  }
}

export default function Settings({ onClose }: SettingsProps) {
  const { settings, setSettings, setPersonality } = useChatStore()
  
  // Initialize localSettings - load from localStorage directly, not from store
  const [localSettings, setLocalSettings] = useState<typeof settings>(() => {
    // Always try to load from localStorage first (most reliable)
    const stored = loadFromStorage()
    console.log('=== SETTINGS LOAD ===')
    console.log('stored from localStorage:', JSON.stringify(stored))
    console.log('store default settings:', JSON.stringify(settings))
    if (stored) {
      const merged = { ...settings, ...stored } as typeof settings
      console.log('merged settings:', JSON.stringify(merged))
      console.log('>>> modelName after merge:', merged.modelName)
      return merged
    }
    // Fall back to store settings
    return settings
  })
  
  // Local personality state (load from localStorage)
  const [localPersonality, setLocalPersonality] = useState<string>(loadPersonalityFromStorage)
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [openaiModels, setOpenaiModels] = useState<string[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [showApiKey, setShowApiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Check Ollama status and fetch models
  useEffect(() => {
    if (localSettings.apiProvider === 'ollama') {
      checkOllamaConnection(localSettings.ollamaUrl).then(connected => {
        setOllamaStatus(connected ? 'connected' : 'disconnected')
        if (connected) {
          getOllamaModels(localSettings.ollamaUrl).then(models => {
            setOllamaModels(models)
            if (models.length > 0 && !localSettings.modelName) {
              setLocalSettings(prev => ({ ...prev, modelName: models[0] }))
            }
          })
        }
      })
    }
  }, [localSettings.apiProvider, localSettings.ollamaUrl])
  
  // Fetch OpenAI models when API URL or Key changes
  const handleFetchModels = async () => {
    if (!localSettings.apiUrl || !localSettings.apiKey) return
    
    setModelsLoading(true)
    try {
      const models = await fetchOpenAIModels(localSettings.apiUrl, localSettings.apiKey)
      setOpenaiModels(models)
      if (models.length > 0 && !localSettings.modelName) {
        setLocalSettings(prev => ({ ...prev, modelName: models[0] }))
      }
    } finally {
      setModelsLoading(false)
    }
  }
  
  // Auto-fetch models when API key is entered
  useEffect(() => {
    if (localSettings.apiProvider === 'openai' && localSettings.apiUrl && localSettings.apiKey) {
      // Debounce the fetch
      const timer = setTimeout(() => {
        fetchOpenAIModels(localSettings.apiUrl, localSettings.apiKey).then(models => {
          setOpenaiModels(models)
          if (models.length > 0 && !localSettings.modelName) {
            setLocalSettings(prev => ({ ...prev, modelName: models[0] }))
          }
        })
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [localSettings.apiProvider, localSettings.apiUrl, localSettings.apiKey])
  
  // Load settings from electron store on mount
  useEffect(() => {
    // Try electron store first
    if (window.electron) {
      window.electron.getSettings().then((stored: Record<string, unknown>) => {
        if (stored && Object.keys(stored).length > 0) {
          setLocalSettings(prev => ({ ...prev, ...stored } as typeof prev))
          setSettings(stored as any)
        }
        // Also load personality from electron
        window.electron.getSetting('personality').then((pers: unknown) => {
          if (pers) {
            setLocalPersonality(pers as string)
            setPersonality(pers as string)
          }
        })
      }).catch(() => {
        // Fallback to localStorage
        const stored = loadFromStorage()
        if (stored) {
          setLocalSettings(prev => ({ ...prev, ...stored } as typeof prev))
          setSettings(stored as any)
        }
        const pers = loadPersonalityFromStorage()
        setLocalPersonality(pers)
        setPersonality(pers)
      })
    } else {
      // Browser: load from localStorage - settings already loaded in useState initializer
      const stored = loadFromStorage()
      console.log('=== USE EFFECT: ELECTRON NOT AVAILABLE ===')
      console.log('loaded from localStorage:', JSON.stringify(stored))
      if (stored) {
        console.log('>>> Calling setSettings from useEffect')
        setSettings(stored as unknown as Settings)
      }
      const pers = loadPersonalityFromStorage()
      setLocalPersonality(pers)
      setPersonality(pers)
    }
  }, [setSettings, setPersonality])
  
  const handleSave = async () => {
    setSaving(true)
    try {
      console.log('=== SETTINGS SAVE ===')
      console.log('localSettings to save:', JSON.stringify(localSettings))
      console.log('modelName being saved:', localSettings.modelName)
      
      // Ensure we have a complete settings object with all required fields
      const settingsToSave = {
        apiProvider: localSettings.apiProvider || 'openai',
        apiUrl: localSettings.apiUrl || 'https://api.openai.com/v1',
        apiKey: localSettings.apiKey || '',
        modelName: localSettings.modelName || 'gpt-3.5-turbo',
        ollamaUrl: localSettings.ollamaUrl || 'http://localhost:11434',
        avatarEmotion: localSettings.avatarEmotion || 'happy',
        voiceEnabled: localSettings.voiceEnabled || false,
        volume: localSettings.volume ?? 0.8,
        language: localSettings.language || 'zh-CN',
        webSearchEnabled: localSettings.webSearchEnabled || false,
        searchApiKey: localSettings.searchApiKey || '',
        searchApiUrl: localSettings.searchApiUrl || ''
      }
      
      console.log('>>> Complete settings to save:', JSON.stringify(settingsToSave))
      console.log('>>> modelName in settingsToSave:', settingsToSave.modelName)
      
      // Save settings to localStorage FIRST (most reliable)
      saveToStorage(settingsToSave as unknown as Record<string, unknown>)
      
      // Save personality to localStorage
      savePersonalityToStorage(localPersonality)
      console.log('Saved to localStorage')
      
      // Save to electron store if available
      if (window.electron) {
        for (const [key, value] of Object.entries(settingsToSave)) {
          await window.electron.setSetting(key, value)
        }
        await window.electron.setSetting('personality', localPersonality)
        console.log('Saved to electron store')
      }
      
      // Update the Zustand store with the new settings - use the complete object
      console.log('>>> Calling setSettings with modelName:', settingsToSave.modelName)
      setSettings(settingsToSave)
      setPersonality(localPersonality)
      console.log('Updated Zustand store')
      
      // Close modal after a small delay to ensure store updates propagate
      setTimeout(() => {
        onClose()
        console.log('Modal closed')
      }, 50)
    } catch (error) {
      console.error('Error saving settings:', error)
      // Emergency save to localStorage
      saveToStorage(localSettings as unknown as Record<string, unknown>)
      setSettings(localSettings)
      onClose()
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>⚙️ Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="settings-content">
          {/* API Provider */}
          <div className="settings-section">
            <h3>API Provider</h3>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="apiProvider"
                  value="openai"
                  checked={localSettings.apiProvider === 'openai'}
                  onChange={() => setLocalSettings({ ...localSettings, apiProvider: 'openai' })}
                />
                <span className="radio-label">
                  <span className="radio-title">OpenAI Compatible</span>
                  <span className="radio-desc">Use OpenAI or compatible APIs</span>
                </span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="apiProvider"
                  value="ollama"
                  checked={localSettings.apiProvider === 'ollama'}
                  onChange={() => setLocalSettings({ ...localSettings, apiProvider: 'ollama' })}
                />
                <span className="radio-label">
                  <span className="radio-title">Ollama (Local)</span>
                  <span className="radio-desc">Run models locally</span>
                </span>
              </label>
            </div>
          </div>
          
          {/* OpenAI Settings */}
          {localSettings.apiProvider === 'openai' && (
            <div className="settings-section">
              <h3>OpenAI Configuration</h3>
              <div className="form-group">
                <label>API URL</label>
                <input
                  type="text"
                  value={localSettings.apiUrl}
                  onChange={e => setLocalSettings({ ...localSettings, apiUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div className="form-group">
                <label>API Key</label>
                <div className="input-with-toggle">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={localSettings.apiKey}
                    onChange={e => setLocalSettings({ ...localSettings, apiKey: e.target.value })}
                    placeholder="sk-..."
                  />
                  <button
                    className="toggle-btn"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Model Name</label>
                {openaiModels.length > 0 ? (
                  <select
                    value={localSettings.modelName}
                    onChange={e => setLocalSettings({ ...localSettings, modelName: e.target.value })}
                  >
                    {openaiModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                ) : (
                  <div className="model-input-group">
                    <input
                      type="text"
                      value={localSettings.modelName}
                      onChange={e => setLocalSettings({ ...localSettings, modelName: e.target.value })}
                      placeholder="gpt-3.5-turbo"
                    />
                    <button
                      className="fetch-btn"
                      onClick={handleFetchModels}
                      disabled={modelsLoading || !localSettings.apiKey}
                    >
                      {modelsLoading ? '...' : 'Fetch'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Ollama Settings */}
          {localSettings.apiProvider === 'ollama' && (
            <div className="settings-section">
              <h3>Ollama Configuration</h3>
              <div className="form-group">
                <label>Ollama URL</label>
                <input
                  type="text"
                  value={localSettings.ollamaUrl}
                  onChange={e => setLocalSettings({ ...localSettings, ollamaUrl: e.target.value })}
                  placeholder="http://localhost:11434"
                />
                <span className={`status-badge status-${ollamaStatus}`}>
                  {ollamaStatus === 'checking' && 'Checking...'}
                  {ollamaStatus === 'connected' && '✓ Connected'}
                  {ollamaStatus === 'disconnected' && '✗ Not connected'}
                </span>
              </div>
              {ollamaModels.length > 0 && (
                <div className="form-group">
                  <label>Available Models</label>
                  <select
                    value={localSettings.modelName}
                    onChange={e => setLocalSettings({ ...localSettings, modelName: e.target.value })}
                  >
                    {ollamaModels.map(model => (
                      <option key={model} value={model}>{model}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          
          {/* Personality */}
          <div className="settings-section">
            <h3>Personality</h3>
            <div className="personality-grid">
              {Object.keys(PERSONALITY_PROMPTS).map(key => (
                <button
                  key={key}
                  className={`personality-btn ${localPersonality === key ? 'active' : ''}`}
                  onClick={() => setLocalPersonality(key)}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
          
          {/* Voice Settings */}
          <div className="settings-section">
            <h3>Voice Settings</h3>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={localSettings.voiceEnabled}
                  onChange={e => setLocalSettings({ ...localSettings, voiceEnabled: e.target.checked })}
                />
                <span>Enable Text-to-Speech</span>
              </label>
            </div>
            {localSettings.voiceEnabled && (
              <div className="form-group">
                <label>Volume</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={localSettings.volume}
                  onChange={e => setLocalSettings({ ...localSettings, volume: parseFloat(e.target.value) })}
                />
                <span className="volume-value">{Math.round(localSettings.volume * 100)}%</span>
              </div>
            )}
          </div>
          
          {/* Web Search Settings */}
          <div className="settings-section">
            <h3>Web Search Settings</h3>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={localSettings.webSearchEnabled}
                  onChange={e => setLocalSettings({ ...localSettings, webSearchEnabled: e.target.checked })}
                />
                <span>Enable Web Search (联网搜索)</span>
              </label>
              <p className="setting-hint">
                启用后，当您认为AI回答不正确时，说"不对"、"错了"等关键词会自动触发联网搜索
              </p>
            </div>
            
            {localSettings.webSearchEnabled && (
              <>
                <div className="form-group">
                  <label>搜索 API Key (推荐博查AI)</label>
                  <input
                    type="password"
                    value={localSettings.searchApiKey}
                    onChange={e => setLocalSettings({ ...localSettings, searchApiKey: e.target.value })}
                    placeholder="博查AI / SerpAPI / Bing API Key"
                  />
                  <p className="setting-hint">
                    推荐 <a href="https://open.bochaai.com/" target="_blank" rel="noopener noreferrer">博查AI</a> (国内可用，免费额度)，或使用 SerpAPI/Bing
                  </p>
                </div>
                <div className="form-group">
                  <label>搜索 API 端点 (可选)</label>
                  <input
                    type="text"
                    value={localSettings.searchApiUrl}
                    onChange={e => setLocalSettings({ ...localSettings, searchApiUrl: e.target.value })}
                    placeholder="留空自动使用博查AI"
                  />
                  <p className="setting-hint">
                    填写自定义端点，不填则默认使用博查AI (国内快速)
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
        
        <div className="settings-footer">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
