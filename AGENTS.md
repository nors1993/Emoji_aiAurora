# PROJECT KNOWLEDGE BASE

**Generated:** 2026-06-04
**Commit:** 78d57be (verify with `git log -1 --format="%H"`)
**Branch:** main

## OVERVIEW

AI-powered virtual companion with emotional 3D avatar. React + Three.js web app with optional Electron desktop wrapper.

## COMMANDS

```bash
npm run dev           # Web dev server (localhost:5173)
npm run build         # Production web build
npm run electron:dev  # Desktop dev mode (concurrent dev + electron)
npm run electron:build # Desktop production build
```

## STRUCTURE

```
./
├── src/
│   ├── components/
│   │   ├── Avatar/AvatarCanvas.tsx  # Three.js 3D avatar, emotion expressions
│   │   ├── Chat/Chat.tsx            # Chat UI, voice, search, Markdown
│   │   └── Settings/Settings.tsx    # API config, personality settings
│   ├── stores/chatStore.ts          # Zustand + localStorage (dual sync)
│   ├── types/index.ts               # Emotion types (21 emotions), Settings
│   ├── utils/
│   │   ├── llm.ts                   # LLM calls, emotion detection
│   │   ├── streamParser.ts           # SSE/NDJSON stream parsing
│   │   ├── webSearch.ts              # Multi-provider search chain
│   │   ├── audioCapture.ts          # ASR audio capture
│   │   └── ttsClient.ts              # TTS streaming client
│   ├── App.tsx                       # Root component, split panels
│   └── main.tsx                      # Entry point
├── electron/                         # Desktop wrapper (main.ts, preload.ts)
├── package.json
├── vite.config.ts                   # @/ path alias configured
└── tsconfig.json                    # Strict mode, react-jsx
```

## KEY ARCHITECTURE PATTERNS

### Settings Management (CRITICAL)

Settings are stored in **TWO places** and synced:
- `localStorage` (primary, synchronous load)
- Zustand store (reactive, initialized from localStorage)

**Important**: When you need settings values during render, read from `localStorage` directly. Reading from Zustand during initial render returns stale defaults because Zustand initializes asynchronously.

```typescript
// WRONG - stale defaults
const { settings } = useChatStore()
useEffect(() => { sendToLLM(settings.apiKey) }, [settings])

// CORRECT - fresh values
function loadFromStorage(): Record<string, unknown> | null {
  const stored = localStorage.getItem('aiAurora_settings')
  return stored ? JSON.parse(stored) : null
}
```

Storage keys: `aiAurora_settings`, `aiAurora_personality`, `aiAurora_splitRatio`

### LLM Integration

Two providers with different streaming protocols:
- **OpenAI**: SSE (Server-Sent Events) → `streamParser.ts`
- **Ollama**: NDJSON (newline-delimited JSON) → same parser handles both

Emotion detection chain (in priority order):
1. JSON extraction from LLM response
2. LLM analysis with dedicated prompt
3. Keyword fallback (20+ keywords in `llm.ts:16-45`)

### Emotion System

21 emotions with PAD (Pleasure-Arousal-Dominance) model. Each emotion has:
- Unique Three.js visual expression (eyes, mouth, eyebrows, blush)
- Color mapping
- Eye shape variants (normal, squinted, droopy, narrowed, etc.)

Emotion configs in `AvatarCanvas.tsx:16-248` (colors, eye configs).
Emotion library definitions in `types/index.ts:55+` (PAD values, keywords).

## WHERE TO LOOK

| Task | Location | Key Details |
|------|----------|-------------|
| 3D Avatar expressions | `AvatarCanvas.tsx` | Eye/mouth configs, emotion colors, shake/pulse effects |
| Emotion detection | `llm.ts` | `detectEmotion()`, `analyzeEmotionFromContext()` |
| Chat + voice + search | `Chat.tsx` | Markdown, ASR/TTS, web search toggle |
| Settings UI | `Settings.tsx` | API config, personality selector, voice settings |
| State + persistence | `chatStore.ts` | Zustand store, localStorage sync, system prompts |
| Type definitions | `types/index.ts` | Emotion types, Settings interface, PERSONALITY_PROMPTS |

## CODE MAP

| Symbol | Type | Location | Used By |
|--------|------|----------|---------|
| `sendToLLM` | function | utils/llm.ts | Chat.tsx |
| `chatStore` | store | stores/chatStore.ts | App, Chat, Settings |
| `EMOTION_LIBRARY` | const | types/index.ts | AvatarCanvas |
| `webSearch` | function | utils/webSearch.ts | Chat.tsx |
| `consumeEventSourceStream` | generator | utils/streamParser.ts | llm.ts |

## CRITICAL ANTI-PATTERNS

1. **DO NOT re-read settings from Zustand during render** — stale defaults (see Settings Management above)
2. **`@ts-ignore` in Chat.tsx:13** — SpeechRecognition API hack, do not remove
3. **`as any` / `as unknown as`** — type assertions in Settings.tsx, App.tsx, Chat.tsx
4. **console.log everywhere** — 30+ instances, security risk (API key logging at llm.ts:189)
5. **Empty catch blocks** — swallows errors silently
6. **deprecated `substr`** in chatStore.ts → use `substring`
7. **`Math.random()`** for emotion selection in llm.ts:116
8. **Duplicate localStorage reads** — Settings.tsx and chatStore.ts both read localStorage

## UNIQUE PATTERNS

- **Electron mock polyfill**: `window.electron` exists in browser dev mode for cross-platform compatibility
- **Voice toggle IPC**: `window.electron.onToggleVoice()` in Chat.tsx for Electron voice button
- **Intro mode**: Random emotion animation when idle (controlled in chatStore)
- **Split panel**: Draggable divider between avatar and chat, ratio stored in localStorage

## MISSING INFRASTRUCTURE

- **No tests** — zero testing infrastructure
- **No ESLint/Prettier** — code style enforced only by TS strict mode
- **No type assertions for SpeechRecognition** — `@ts-ignore` workaround

## CONVENTIONS

- **TypeScript**: Strict mode (`strict: true`), no unused vars/params
- **Imports**: Use `@/` path alias (`@/utils/llm` NOT `../../utils/llm`)
- **JSX**: react-jsx (no `import React` needed)
- **ESM**: `"type": "module"` in package.json
- **Module resolution**: `bundler` (Vite)
- **Build output**: `dist/` for web, `dist-electron/` for Electron

## VOICE SERVICES (Optional)

Requires local inference servers:
- **ASR** (FunASR/SenseVoice): `http://localhost:8001` (default)
- **TTS** (Qwen3-TTS): `http://localhost:8002` (default)
- Configurable in Settings UI
- Stream mode: TTS generates and plays sentence-by-sentence