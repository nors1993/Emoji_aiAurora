# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-29
**Commit:** 78d57be
**Branch:** main

## OVERVIEW

AI-powered virtual companion with emotional 3D avatar. React + Three.js web app with optional Electron desktop wrapper.

## STRUCTURE

```
./
├── src/
│   ├── components/       # React UI: Avatar (3D), Chat, Settings
│   ├── stores/           # Zustand state (chatStore.ts)
│   ├── types/            # TypeScript + emotion library data
│   ├── utils/            # LLM, stream, web search
│   ├── App.tsx           # Root component
│   └── main.tsx          # Entry point
├── electron/             # Desktop wrapper (main.ts, preload.ts)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| 3D Avatar | `src/components/Avatar/AvatarCanvas.tsx` | 21-emotion PAD model, Three.js |
| Chat UI | `src/components/Chat/Chat.tsx` | Markdown, voice, search |
| Settings | `src/components/Settings/Settings.tsx` | API config, personality |
| LLM Integration | `src/utils/llm.ts` | OpenAI SSE, Ollama NDJSON |
| State | `src/stores/chatStore.ts` | Zustand + localStorage |
| Types | `src/types/index.ts` | 21 emotions, personalities |

## CODE MAP

| Symbol | Type | Location | Refs |
|--------|------|----------|------|
| sendToLLM | function | utils/llm.ts | Chat.tsx |
| chatStore | store | stores/chatStore.ts | App,Chat,Settings |
| EMOTION_LIBRARY | const | types/index.ts | AvatarCanvas |
| AvatarCanvas | component | AvatarCanvas.tsx | App.tsx |
| Chat | component | Chat.tsx | App.tsx |

## CONVENTIONS

- **TypeScript**: Strict mode enabled, no unused vars/params
- **Imports**: Use `@/` path alias (`@/utils/llm` NOT `../../utils/llm`)
- **JSX**: react-jsx (no `import React` needed)
- **ESM**: `"type": "module"` in package.json

## ANTI-PATTERNS (THIS PROJECT)

1. **DO NOT re-read settings from Zustand** after initial load — stale defaults
2. **@ts-ignore** in Chat.tsx:13 for SpeechRecognition (hack)
3. **`as any` / `as unknown as`** type assertions in Settings.tsx, App.tsx
4. **console.log** debug statements left in production (30+ instances)
5. **API key logging** in llm.ts:189 — security risk
6. **Empty catch blocks** — swallows errors silently
7. **deprecated `substr`** in chatStore.ts:88 — use `substring`
8. **`Math.random()`** for emotion selection in llm.ts:116

## UNIQUE STYLES

- 21-emotion PAD model system with visual expressions
- Triple emotion detection: JSON parse → LLM analyze → keyword fallback
- Multi-provider web search chain (Bocha AI → SerpAPI → Wikipedia → DDG)
- Electron mock polyfill for browser dev mode

## COMMANDS

```bash
npm run dev           # Web dev server (localhost:5173)
npm run build         # Production web build
npm run electron:dev  # Desktop dev mode
npm run electron:build # Desktop production build
```

## NOTES

- No tests — zero testing infrastructure
- No ESLint/Prettier — code style only enforced by TS strict
- Voice feature documented as unsupported
- `electron/main.ts` loads either dev server or production `dist/`
