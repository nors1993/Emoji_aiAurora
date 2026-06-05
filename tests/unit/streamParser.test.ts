import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Simple stream parser test helper
async function parseSSE(input: string): Promise<string[]> {
  const chunks: string[] = []
  const lines = input.split('\n')
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6)
      if (data === '[DONE]') break
      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content || ''
        if (content) chunks.push(content)
      } catch {
        // Skip malformed lines
      }
    }
  }
  
  return chunks
}

describe('Stream Parser - SSE', () => {
  describe('LLM-001: SSE single chunk parsing', () => {
    it('parses single SSE chunk correctly', async () => {
      const input = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
      const chunks = await parseSSE(input)
      expect(chunks).toEqual(['Hello'])
    })
  })

  describe('LLM-002: SSE multiple chunks', () => {
    it('parses multiple SSE chunks in sequence', async () => {
      const input = `data: {"choices":[{"delta":{"content":"Hi"}}]}
data: {"choices":[{"delta":{"content":" there"}}]}
`
      const chunks = await parseSSE(input)
      expect(chunks).toEqual(['Hi', ' there'])
    })
  })

  describe('LLM-003: SSE [DONE] termination', () => {
    it('stops parsing on [DONE] signal', async () => {
      const input = `data: {"choices":[{"delta":{"content":"Bye"}}]}
data: [DONE]
`
      const chunks = await parseSSE(input)
      expect(chunks).toEqual(['Bye'])
    })
  })

  describe('LLM-004: SSE malformed JSON handling', () => {
    it('skips malformed JSON lines', async () => {
      const input = `data: {invalid json}
data: {"choices":[{"delta":{"content":"OK"}}]}
`
      const chunks = await parseSSE(input)
      expect(chunks).toEqual(['OK'])
    })
  })
})

describe('Stream Parser - NDJSON (Ollama)', () => {
  async function parseNDJSON(input: string): Promise<string[]> {
    const chunks: string[] = []
    const lines = input.split('\n').filter(Boolean)
    
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        if (parsed.message?.content) {
          chunks.push(parsed.message.content)
        }
        if (parsed.done) break
      } catch {
        // Skip
      }
    }
    
    return chunks
  }

  describe('LLM-006: NDJSON single message', () => {
    it('parses single NDJSON message', async () => {
      const input = '{"message":{"content":"Hello"}}\n'
      const chunks = await parseNDJSON(input)
      expect(chunks).toEqual(['Hello'])
    })
  })

  describe('LLM-007: NDJSON multiple messages', () => {
    it('parses multiple NDJSON messages', async () => {
      const input = `{"message":{"content":"Hi"}}
{"message":{"content":" there"}}
`
      const chunks = await parseNDJSON(input)
      expect(chunks).toEqual(['Hi', ' there'])
    })
  })

  describe('LLM-008: NDJSON done signal', () => {
    it('handles done signal', async () => {
      const input = `{"message":{"content":"Bye"}}
{"done":true}
`
      const chunks = await parseNDJSON(input)
      expect(chunks).toEqual(['Bye'])
    })
  })
})