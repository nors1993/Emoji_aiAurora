import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import log from 'electron-log'

// ESM compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configure logging
log.transports.file.level = 'info'
log.transports.console.level = 'debug'
log.info('aiAurora starting...')

// Simple in-memory store for settings (avoid electron-store issues in packaged app)
const defaultSettings = {
  windowBounds: { width: 1200, height: 800 },
  apiProvider: 'openai',
  apiUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: 'gpt-3.5-turbo',
  ollamaUrl: 'http://localhost:11434',
  avatarEmotion: 'happy',
  voiceEnabled: false,
  volume: 0.8
}

let settings = { ...defaultSettings }

function getSetting(key: string) {
  return settings[key as keyof typeof defaultSettings]
}

function setSetting(key: string, value: unknown) {
  (settings as Record<string, unknown>)[key] = value
  log.info(`Setting updated: ${key}`)
}

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
log.info(`Running in ${isDev ? 'development' : 'production'} mode`)

function createWindow() {
  const { width, height } = getSetting('windowBounds') as { width: number; height: number }

  log.info(`Creating window: ${width}x${height}`)

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 900,
    minHeight: 600,
    title: 'aiAurora',
    backgroundColor: '#0a0a1a',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  })

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    log.info('Window ready to show')
    mainWindow?.show()
  })

  // Save window size on resize
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      setSetting('windowBounds', { width: bounds.width, height: bounds.height })
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Load the app
  if (isDev) {
    log.info('Loading dev server at http://localhost:5173')
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    const indexPath = join(__dirname, '../dist/index.html')
    log.info(`Loading production file: ${indexPath}`)
    mainWindow.loadFile(indexPath)
  }

  log.info('Window created successfully')
}

function registerShortcuts() {
  // Global shortcut to toggle voice input
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    mainWindow?.webContents.send('toggle-voice')
    log.info('Voice toggle shortcut triggered')
  })
}

// IPC Handlers for settings
ipcMain.handle('get-settings', () => {
  return settings
})

ipcMain.handle('set-setting', (_, key: string, value: unknown) => {
  setSetting(key, value)
  return true
})

ipcMain.handle('get-setting', (_, key: string) => {
  return getSetting(key)
})

// App lifecycle
app.whenReady().then(() => {
  log.info('App ready')
  createWindow()
  registerShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  log.info('aiAurora shutting down')
})
