import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Mock electron for browser environment
// NOTE: getSettings returns null to force fallback to localStorage
// This ensures saved settings persist correctly in browser
if (typeof window !== 'undefined' && !(window as any).electron) {
  (window as any).electron = {
    getSettings: () => Promise.resolve(null), // Return null to trigger localStorage fallback
    setSetting: () => Promise.resolve(true),
    getSetting: () => Promise.resolve(null),
    onToggleVoice: () => () => {},
    platform: 'browser'
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
