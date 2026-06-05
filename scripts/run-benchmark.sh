#!/bin/bash
# Emoji_aiAurora Benchmark Runner
# Usage: npm run benchmark

set -e

echo "========================================"
echo "Emoji_aiAurora Benchmark Suite"
echo "========================================"

# Check if vitest is installed
if ! npm list vitest &> /dev/null; then
  echo "Installing test dependencies..."
  npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
fi

# Parse benchmark files and run tests
BENCHMARK_DIR="./benchmark"

echo ""
echo "📊 Running Benchmark Tests..."
echo ""

# Run unit tests
echo "🧪 Running Unit Tests..."
npm run test:unit

echo ""
echo "✅ Benchmark tests complete!"
echo ""

# Display summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "Unit tests: $(npm run test:unit -- --silent 2>&1 | tail -1 || echo 'run npm test:unit')"