/**
 * Web Search Utility — scrapling‑based search
 *
 * Calls a local Scrapling Python server that scrapes DuckDuckGo HTML results
 * using Scrapling's anti‑bot FetcherSession.  No external API keys required.
 *
 * Start the server:
 *   .venv/bin/python models_infer/scrapling_server.py
 * Default port: 8003
 */

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export interface SearchResponse {
  results: SearchResult[]
  provider: string
  error?: string
}

/**
 * Check whether the Scrapling search server is running.
 * Returns true if the /health endpoint responds within 2 seconds.
 */
export async function checkScraplingHealth(
  scraplingUrl?: string,
): Promise<boolean> {
  const baseUrl = scraplingUrl || 'http://localhost:8003'
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const response = await fetch(`${baseUrl}/health`, {
      signal: controller.signal,
    })
    clearTimeout(timeout)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Scrapling‑powered web search.
 *
 * @param query          Search query
 * @param scraplingUrl   Scrapling server URL (default http://localhost:8003)
 * @param scraplingApiKey API key for the Scrapling server (default sk-scrapling-demo)
 */
export async function webSearch(
  query: string,
  scraplingUrl?: string,
  scraplingApiKey?: string,
): Promise<SearchResponse> {
  const cleanQuery = query.trim()
  if (!cleanQuery) {
    return { results: [], provider: 'none', error: 'Empty query' }
  }

  const baseUrl = scraplingUrl || 'http://localhost:8003'
  const apiKey = scraplingApiKey || 'sk-scrapling-demo'

  console.log('[WebSearch] Scrapling search for:', cleanQuery)

  try {
    const response = await fetch(`${baseUrl}/v1/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: cleanQuery, count: 5 }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Scrapling server HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log('[WebSearch] Results:', data.results?.length ?? 0)

    return {
      results: (data.results || []).slice(0, 5),
      provider: data.provider || 'DuckDuckGo (Scrapling)',
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.warn('[WebSearch] Scrapling search failed:', errMsg)
    return { results: [], provider: 'none', error: errMsg }
  }
}

/**
 * Format search results as a human-readable string for LLM context injection.
 */
export function formatSearchResultsForLLM(searchResponse: SearchResponse): string {
  if (searchResponse.results.length === 0) {
    return ''
  }

  const lines: string[] = []
  lines.push('[Web Search Results]')
  lines.push(`Source: ${searchResponse.provider}`)
  lines.push('')

  searchResponse.results.forEach((result, index) => {
    lines.push(`${index + 1}. ${result.title}`)
    lines.push(`   URL: ${result.url}`)
    if (result.snippet) {
      lines.push(`   Summary: ${result.snippet}`)
    }
    lines.push('')
  })

  return lines.join('\n')
}

/**
 * Check whether a user's message triggers an automatic re‑search.
 */
export function shouldTriggerAutoSearch(userMessage: string): boolean {
  const lowerMessage = userMessage.toLowerCase()

  const cnNegative = [
    '不对', '错了', '不是', '不正确', '错误', '假', '假的',
    '不是这样', '你说错了', '你搞错了', '重新回答', '再查', '查一下', '搜一下',
    '是真的吗', '确定吗', '是真的么', '可靠吗', '不对吧', '真的吗',
  ]

  const enNegative = [
    'wrong', 'incorrect', 'not right', 'false', 'fake',
    "that's wrong", "you're wrong", 'not correct', 'are you sure',
    'search', 'look it up', 'check', 'recheck', 'not sure',
  ]

  const allKeywords = [...cnNegative, ...enNegative]

  return allKeywords.some(keyword => lowerMessage.includes(keyword))
}
