import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electron', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('set-setting', key, value),
  getSetting: (key: string) => ipcRenderer.invoke('get-setting', key),

  // Event listeners
  onToggleVoice: (callback: () => void) => {
    ipcRenderer.on('toggle-voice', callback)
    return () => ipcRenderer.removeListener('toggle-voice', callback)
  },

  // Platform info
  platform: process.platform
})

// Type definitions for the exposed API
declare global {
  interface Window {
    electron: {
      getSettings: () => Promise<Record<string, unknown>>
      setSetting: (key: string, value: unknown) => Promise<boolean>
      getSetting: (key: string) => Promise<unknown>
      onToggleVoice: (callback: () => void) => () => void
      platform: NodeJS.Platform
    }
  }
}
