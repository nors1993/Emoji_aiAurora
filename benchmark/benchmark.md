# Emoji_aiAurora Benchmark Specification

**Version:** 1.0.0  
**Date:** 2026-06-04

---

## 1. Overview

This document defines the comprehensive benchmark suite for the Emoji_aiAurora project — an AI-powered virtual companion with an emotional 3D avatar.

### 1.1 Scope

| Domain | Coverage | Benchmark File |
|--------|----------|----------------|
| Emotion System | 21 emotions, PAD model, visual expressions | `emotion-benchmark.json` |
| LLM Integration | OpenAI SSE, Ollama NDJSON, emotion detection | `llm-benchmark.json` |
| Voice Services | ASR capture, TTS streaming, endpoint health | `voice-benchmark.json` |
| End-to-End | Avatar+Chat orchestration, settings persistence, Electron IPC | `integration-benchmark.json` |
| Performance | FPS, latency, memory, render time | `performance-benchmark.json` |

### 1.2 Severity Levels

| Level | Definition |
|-------|-----------|
| **P0 - Critical** | Feature completely broken; data loss or security leak |
| **P1 - High** | Core feature degraded; wrong emotion, broken stream |
| **P2 - Medium** | Non-core feature broken; fallback works but suboptimal |
| **P3 - Low** | Cosmetic or edge-case issue |

---

## 2. Functional Coverage

### 2.1 Emotion System
- 21 emotion definitions (BaseEmotion + PersonalityEmotion)
- PAD values (valence, arousal, dominance)
- Keyword-to-emotion mapping
- Emotion-to-TTS instruct mapping
- Emotion-to-color mapping
- Eye config per emotion (7 shapes)
- Shake effect (angry only)
- Pulse effect (intense emotions)
- Intro mode random emotion cycling

### 2.2 LLM Integration
- OpenAI SSE streaming
- Ollama NDJSON streaming
- Emotion detection: JSON extraction
- Emotion detection: keyword fallback
- Emotion detection: context analysis

### 2.3 Voice Services
- AudioCapture: microphone → PCM 16kHz 16-bit mono
- TTSClient: streaming audio generation
- ASR endpoint health check
- TTS endpoint health check

### 2.4 Settings & Persistence
- localStorage + Zustand dual sync
- API key configuration
- Personality prompt selection
- Split panel ratio persistence

### 2.5 Desktop Integration (Electron)
- Voice toggle IPC
- Window management
- System tray (optional)

---

## 3. Critical Anti-Patterns (Must Not Break)

1. **Zustand Stale Defaults**: Settings must read from localStorage during render, NOT from Zustand
2. **API Key Logging**: Never log Authorization headers
3. **Empty Catch Blocks**: Errors must be handled properly
4. **Deprecated substr**: Use substring instead

---

## 4. Test Methodology

### 4.1 Unit Tests
- Pure functions with no side effects
- Emotion detection logic
- Stream parsing logic
- Text cleaning utilities

### 4.2 Integration Tests
- Component rendering with mocked dependencies
- Cross-component flows (Chat → LLM → Avatar)
- Settings persistence

### 4.3 E2E Tests (Playwright)
- Full user flows
- Browser-specific behavior
- Electron-specific features

### 4.4 Performance Tests
- FPS measurement with requestAnimationFrame
- Latency measurement with timestamps
- Memory profiling with performance.measure

---

## 5. Running Tests

```bash
# Install dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom playwright

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run benchmarks
npm run benchmark
```