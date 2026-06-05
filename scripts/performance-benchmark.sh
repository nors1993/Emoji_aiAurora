#!/bin/bash
# Performance benchmark runner
# Measures FPS, latency, memory usage

set -e

echo "========================================"
echo "Emoji_aiAurora Performance Benchmark"
echo "========================================"

# Check if server is running
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
  echo "⚠ Dev server not running. Starting..."
  npm run dev &
  sleep 5
fi

echo ""
echo "📊 Performance Metrics"
echo "========================================"

# FPS Test
echo ""
echo "1️⃣  FPS Test (Avatar idle)"
echo "    Target: 55+ FPS"
echo "    Open http://localhost:5173 in Chrome DevTools > Performance"
echo "    Measure FPS during idle animation"

# Latency Test
echo ""
echo "2️⃣  LLM Latency Test"
echo "    Target: < 500ms first token (OpenAI), < 200ms (Ollama)"
echo "    Send a message and measure time to first response"

# Memory Test
echo ""
echo "3️⃣  Memory Test"
echo "    Target: < 200MB initial, < 300MB after 10 messages"
echo "    Use Chrome DevTools > Memory tab"

# Voice Test
echo ""
echo "4️⃣  Voice Latency Test"
echo "    ASR: Target < 500ms transcription"
echo "    TTS: Target < 1000ms first audio"

echo ""
echo "========================================"
echo "Run manual tests and record results"
echo "========================================"

# Generate report
cat > benchmark/performance-report.md << 'EOF'
# Performance Benchmark Report

## Date: $(date)

## Results

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Avatar FPS (idle) | 55+ | TBD | ⏳ |
| Avatar FPS (transition) | 45+ | TBD | ⏳ |
| Emotion transition time | < 200ms | TBD | ⏳ |
| LLM first token (OpenAI) | < 500ms | TBD | ⏳ |
| LLM first token (Ollama) | < 200ms | TBD | ⏳ |
| ASR transcription | < 500ms | TBD | ⏳ |
| TTS first audio | < 1000ms | TBD | ⏳ |
| Initial memory | < 200MB | TBD | ⏳ |
| Memory after 10 msgs | < 300MB | TBD | ⏳ |

## Notes

EOF

echo "Report template created: benchmark/performance-report.md"