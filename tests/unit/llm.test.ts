import { describe, it, expect, beforeEach, vi } from 'vitest'
import { detectEmotion, cleanTextForTTS } from '../../src/utils/llm'

describe('Emotion Detection - LLM Utils', () => {
  describe('detectEmotion', () => {
    it('EM-001: Detects happy emotion from Chinese text', () => {
      expect(detectEmotion('今天太开心了！')).toBe('happy')
    })

    it('EM-001: Detects happy emotion from English text', () => {
      expect(detectEmotion("I'm so happy!")).toBe('happy')
    })

    it('EM-002: Detects excited emotion from multiple exclamation marks', () => {
      expect(detectEmotion('太棒了！！！')).toBe('excited')
    })

    it('EM-002: Detects excited from English keywords', () => {
      expect(detectEmotion("I'm so excited!")).toBe('excited')
    })

    it('EM-003: Detects love emotion', () => {
      expect(detectEmotion('我爱你！')).toBe('love')
    })

    it('EM-004: Detects sad emotion from ellipsis', () => {
      expect(detectEmotion('我很难过...')).toBe('sad')
    })

    it('EM-007: Detects thinking from ellipsis', () => {
      expect(detectEmotion('让我想想...')).toBe('thinking')
    })

    it('EM-013: Detects confused from multiple question marks', () => {
      expect(detectEmotion('为什么？？？')).toBe('confused')
    })

    it('EM-014: Fallback to neutral for simple responses', () => {
      expect(detectEmotion('好的')).toBe('neutral')
    })

    it('EM-015: Case insensitive keyword detection', () => {
      expect(detectEmotion("I'M SO HAPPY!")).toBe('happy')
    })
  })

  describe('cleanTextForTTS', () => {
    it('LLM-016: Removes emojis', () => {
      const result = cleanTextForTTS('今天天气真好😊')
      expect(result).toBe('今天天气真好')
      expect(result).not.toContain('😊')
    })

    it('LLM-017: Removes parenthetical content', () => {
      const result = cleanTextForTTS('这个很好（我觉得）')
      expect(result).toBe('这个很好')
    })

    it('LLM-018: Normalizes multiple spaces', () => {
      const result = cleanTextForTTS('今天   天气    好')
      expect(result).toBe('今天 天气 好')
    })

    it('LLM-019: Preserves Chinese punctuation', () => {
      const result = cleanTextForTTS('你好，开心！')
      expect(result).toBe('你好，开心！')
    })

    it('Removes multiple types of emojis', () => {
      const result = cleanTextForTTS('🎉恭喜🎊')
      expect(result).toBe('恭喜')
    })

    it('Handles mixed content', () => {
      const result = cleanTextForTTS('今天真开心😊（好开心啊）哈哈哈！')
      expect(result).toBe('今天真开心好开心啊哈哈哈！')
    })
  })
})