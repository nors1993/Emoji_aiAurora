/**
 * Web Search Utility — DuckDuckGo scraper
 *
 * Calls a local Python server that scrapes DuckDuckGo HTML results.
 * Two endpoints: general search (/v1/search) and news search (/v1/search/news).
 * No external API keys required — pure web scraping.
 *
 * Start the server:
 *   python models_infer/scrapling_server.py
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
 * Check whether the search server is running.
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
 * Detect whether a query is asking for news/current events.
 * Routes to the news-specific endpoint for better results.
 */
function isNewsQuery(query: string): boolean {
  const newsKeywords = [
    // English
    'news', 'headlines', 'breaking', 'latest', 'current events',
    'what happened', 'today', 'this week', 'this month',
    // Chinese
    '新闻', '热点', '头条', '热搜', '快讯', '时讯',
    '今日', '最新', '实时', '本周', '本月', '近期',
    '发生了', '动态',
  ]
  const lower = query.toLowerCase()
  return newsKeywords.some(kw => lower.includes(kw))
}

function isHotNewsQuery(query: string): boolean {
  const hotKeywords = [
    'hot', 'trending', 'top', 'popular',
    '热搜', '热度最高', '最热', '热门', '头条',
    '24小时', '过去24', '今天',
  ]
  const lower = query.toLowerCase()
  return hotKeywords.some(kw => lower.includes(kw))
}

function isCryptoQuery(query: string): boolean {
  const cryptoKeywords = [
    // English
    'crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'blockchain',
    'liquidation', 'liquidity', 'long', 'short', 'futures',
    'token', 'coin', 'altcoin', 'defi',
    // Chinese
    '区块链', '比特币', '以太坊', '币', '合约',
    '爆仓', '清仓', '做多', '做空', '杠杆',
    '虚拟货币', '加密货币', '数字资产', 'web3',
    '行情', '走势', '涨跌',
  ]
  const lower = query.toLowerCase()
  return cryptoKeywords.some(kw => lower.includes(kw))
}

function isLiquidationQuery(query: string): boolean {
  const liqKeywords = [
    'liquidation', 'liquidat', '爆仓', '清仓', '强平',
  ]
  const lower = query.toLowerCase()
  return liqKeywords.some(kw => lower.includes(kw))
}

/**
 * General web search.
 * For news/current events queries, use searchNews() instead.
 */
export async function webSearch(
  query: string,
  scraplingUrl?: string,
  scraplingApiKey?: string,
  count: number = 5,
): Promise<SearchResponse> {
  const cleanQuery = query.trim()
  if (!cleanQuery) {
    return { results: [], provider: 'none', error: 'Empty query' }
  }

  const baseUrl = scraplingUrl || 'http://localhost:8003'
  const apiKey = scraplingApiKey || 'sk-scrapling-demo'

  console.log('[WebSearch] query:', cleanQuery)

  try {
    const response = await fetch(`${baseUrl}/v1/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: cleanQuery, count }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Server HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log('[WebSearch] results:', data.results?.length ?? 0)

    return {
      results: (data.results || []).slice(0, count),
      provider: data.provider || 'DuckDuckGo',
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.warn('[WebSearch] failed:', errMsg)
    return { results: [], provider: 'none', error: errMsg }
  }
}

/**
 * News-specific search.
 * Uses the /v1/search/news endpoint which does multi-strategy scraping
 * to get article-level results instead of site homepages.
 */
export async function searchNews(
  query: string,
  scraplingUrl?: string,
  scraplingApiKey?: string,
  count: number = 15,
): Promise<SearchResponse> {
  const cleanQuery = query.trim()
  if (!cleanQuery) {
    return { results: [], provider: 'none', error: 'Empty query' }
  }

  const baseUrl = scraplingUrl || 'http://localhost:8003'
  const apiKey = scraplingApiKey || 'sk-scrapling-demo'

  console.log('[WebSearch] news query:', cleanQuery)

  try {
    const response = await fetch(`${baseUrl}/v1/search/news`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: cleanQuery, count }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Server HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    console.log('[WebSearch] news results:', data.results?.length ?? 0)

    return {
      results: (data.results || []).slice(0, count),
      provider: data.provider || 'DuckDuckGo News',
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.warn('[WebSearch] news failed:', errMsg)
    return { results: [], provider: 'none', error: errMsg }
  }
}

/**
 * Smart search — auto-detects news intent and routes accordingly.
 * This is the recommended entry point for Chat.tsx.
 */
export async function smartSearch(
  query: string,
  scraplingUrl?: string,
  scraplingApiKey?: string,
): Promise<SearchResponse> {
  // Liquidation/crypto data → crypto liquidation endpoint
  if (isLiquidationQuery(query) && isCryptoQuery(query)) {
    return searchCryptoLiquidation(scraplingUrl, scraplingApiKey, 15)
  }
  // Hot/trending news → hot news endpoint (RSS aggregation)
  if (isHotNewsQuery(query) && isNewsQuery(query)) {
    return fetchHotNews(scraplingUrl, scraplingApiKey, 15)
  }
  // News/current events → news endpoint
  if (isNewsQuery(query)) {
    return searchNews(query, scraplingUrl, scraplingApiKey, 15)
  }
  // Crypto/general blockchain → general web search
  if (isCryptoQuery(query)) {
    return webSearch(query, scraplingUrl, scraplingApiKey, 10)
  }
  // General search
  return webSearch(query, scraplingUrl, scraplingApiKey, 10)
}

/**
 * Fetch hot/trending news from the RSS aggregator.
 * Ignores query — returns top articles from major news sources.
 */
export async function fetchHotNews(
  scraplingUrl?: string,
  scraplingApiKey?: string,
  count: number = 15,
): Promise<SearchResponse> {
  const baseUrl = scraplingUrl || 'http://localhost:8003'
  const apiKey = scraplingApiKey || 'sk-scrapling-demo'

  try {
    const response = await fetch(`${baseUrl}/v1/search/news/hot`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ count }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Server HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    return {
      results: (data.results || []).slice(0, count),
      provider: data.provider || 'RSS Aggregator',
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.warn('[WebSearch] hot news failed:', errMsg)
    return { results: [], provider: 'none', error: errMsg }
  }
}

/**
 * Crypto liquidation data from Binance public API.
 */
export async function searchCryptoLiquidation(
  scraplingUrl?: string,
  scraplingApiKey?: string,
  count: number = 15,
): Promise<SearchResponse> {
  const baseUrl = scraplingUrl || 'http://localhost:8003'
  const apiKey = scraplingApiKey || 'sk-scrapling-demo'

  try {
    const response = await fetch(`${baseUrl}/v1/search/crypto/liquidation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ count }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Server HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    return {
      results: (data.results || []).slice(0, count),
      provider: data.provider || 'Binance Futures',
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.warn('[WebSearch] crypto liquidation failed:', errMsg)
    return { results: [], provider: 'none', error: errMsg }
  }
}

/**
 * Format search results for LLM context injection.
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
