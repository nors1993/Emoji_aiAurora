#!/bin/bash
# Quick validation script for critical benchmark items
# Run this to quickly check if core features work

set -e

echo "========================================"
echo "Emoji_aiAurora Quick Validation"
echo "========================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function
check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ $1${NC}"
  else
    echo -e "${RED}✗ $1${NC}"
  fi
}

echo ""
echo "1️⃣  Checking project structure..."
[ -f "package.json" ] && check "package.json exists" || echo -e "${RED}✗ package.json missing${NC}"
[ -f "src/App.tsx" ] && check "src/App.tsx exists" || echo -e "${RED}✗ App.tsx missing${NC}"
[ -d "src/components" ] && check "src/components exists" || echo -e "${RED}✗ components missing${NC}"
[ -d "benchmark" ] && check "benchmark directory exists" || echo -e "${RED}✗ benchmark missing${NC}"

echo ""
echo "2️⃣  Checking benchmark files..."
[ -f "benchmark/benchmark.md" ] && check "benchmark.md" || echo -e "${RED}✗ benchmark.md missing${NC}"
[ -f "benchmark/emotion-benchmark.json" ] && check "emotion-benchmark.json" || echo -e "${RED}✗ missing${NC}"
[ -f "benchmark/llm-benchmark.json" ] && check "llm-benchmark.json" || echo -e "${RED}✗ missing${NC}"
[ -f "benchmark/voice-benchmark.json" ] && check "voice-benchmark.json" || echo -e "${RED}✗ missing${NC}"
[ -f "benchmark/integration-benchmark.json" ] && check "integration-benchmark.json" || echo -e "${RED}✗ missing${NC}"
[ -f "benchmark/performance-benchmark.json" ] && check "performance-benchmark.json" || echo -e "${RED}✗ missing${NC}"

echo ""
echo "3️⃣  Checking critical source files..."
[ -f "src/utils/llm.ts" ] && check "llm.ts (emotion detection)" || echo -e "${RED}✗ missing${NC}"
[ -f "src/utils/streamParser.ts" ] && check "streamParser.ts (SSE parsing)" || echo -e "${RED}✗ missing${NC}"
[ -f "src/utils/audioCapture.ts" ] && check "audioCapture.ts (ASR)" || echo -e "${RED}✗ missing${NC}"
[ -f "src/utils/ttsClient.ts" ] && check "ttsClient.ts (TTS)" || echo -e "${RED}✗ missing${NC}"
[ -f "src/types/index.ts" ] && check "types/index.ts (emotions)" || echo -e "${RED}✗ missing${NC}"
[ -f "src/stores/chatStore.ts" ] && check "chatStore.ts (state)" || echo -e "${RED}✗ missing${NC}"

echo ""
echo "4️⃣  Checking anti-patterns (should NOT exist)..."
# Check for empty catch blocks
if grep -r "catch.*{}" src/utils/ 2>/dev/null | grep -v ".test." > /dev/null; then
  echo -e "${YELLOW}⚠ Found empty catch blocks in src/utils/${NC}"
else
  check "No empty catch blocks in src/utils/"
fi

# Check for console.log with API key
if grep -r "console.log" src/utils/llm.ts 2>/dev/null | grep -i "auth\|key\|token" > /dev/null; then
  echo -e "${RED}✗ Potential API key logging found in llm.ts${NC}"
else
  check "No API key logging in llm.ts"
fi

echo ""
echo "5️⃣  Validating benchmark JSON syntax..."
for file in benchmark/*.json; do
  if [ -f "$file" ]; then
    python3 -c "import json; json.load(open('$file'))" 2>/dev/null
    check "$(basename $file) is valid JSON"
  fi
done

echo ""
echo "6️⃣  Checking test infrastructure..."
[ -d "tests" ] && check "tests directory exists" || echo -e "${YELLOW}⚠ tests directory missing (run: npm run test:setup)${NC}"
[ -f "vitest.config.ts" ] && check "vitest.config.ts exists" || echo -e "${YELLOW}⚠ vitest.config.ts missing${NC}"

echo ""
echo "========================================"
echo "Validation Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  npm run dev           - Start development server"
echo "  npm run test:unit     - Run unit tests"
echo "  npm run test:coverage - Run with coverage"
echo ""