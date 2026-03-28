/**
 * Web Search Utility
 * 支持 Bing Web Search API (推荐) 和免费备用方案
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
 * 主搜索函数 - 自动选择可用的搜索API
 * 优先级: 自定义 API > SerpAPI > Bocha AI > Wikipedia > DuckDuckGo
 */
export async function webSearch(query: string, searchApiKey?: string, searchApiUrl?: string): Promise<SearchResponse> {
  const cleanQuery = query.trim()
  if (!cleanQuery) {
    return { results: [], provider: 'none', error: 'Empty query' }
  }

  console.log('[WebSearch] Starting search for:', cleanQuery)
  console.log('[WebSearch] Search API Key available:', !!searchApiKey)
  const errors: string[] = []

  // 1. 尝试用户自定义 API 端点
  if (searchApiUrl && searchApiKey) {
    try {
      console.log('[WebSearch] Trying custom search API...')
      const customResult = await searchWithCustomAPI(cleanQuery, searchApiKey, searchApiUrl)
      if (customResult.results.length > 0) {
        console.log('[WebSearch] Custom API succeeded with', customResult.results.length, 'results')
        return customResult
      }
      console.log('[WebSearch] Custom API returned 0 results')
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.warn('[WebSearch] Custom API failed:', errMsg)
      errors.push(`Custom: ${errMsg}`)
    }
  }

  // 2. 尝试博查AI搜索 (国内可用!)
  if (searchApiKey) {
    try {
      console.log('[WebSearch] Trying Bocha AI Search...')
      const bochaResult = await searchWithBochaAI(cleanQuery, searchApiKey)
      if (bochaResult.results.length > 0) {
        console.log('[WebSearch] Bocha AI succeeded with', bochaResult.results.length, 'results')
        return bochaResult
      }
      console.log('[WebSearch] Bocha AI returned 0 results')
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.warn('[WebSearch] Bocha AI failed:', errMsg)
      errors.push(`Bocha AI: ${errMsg}`)
    }
  }

  // 3. 尝试 SerpAPI (需要翻墙)
  if (searchApiKey && searchApiUrl === 'serpapi') {
    try {
      console.log('[WebSearch] Trying SerpAPI...')
      const serpResult = await searchWithSerpAPI(cleanQuery, searchApiKey)
      if (serpResult.results.length > 0) {
        console.log('[WebSearch] SerpAPI succeeded with', serpResult.results.length, 'results')
        return serpResult
      }
      console.log('[WebSearch] SerpAPI returned 0 results')
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.warn('[WebSearch] SerpAPI failed:', errMsg)
      errors.push(`SerpAPI: ${errMsg}`)
    }
  }

  // 4. 尝试 Wikipedia (免费，支持 CORS，最可靠)
  try {
    console.log('[WebSearch] Trying Wikipedia...')
    const wikiResult = await searchWithWikipedia(cleanQuery)
    if (wikiResult.results.length > 0) {
      console.log('[WebSearch] Wikipedia succeeded with', wikiResult.results.length, 'results')
      return wikiResult
    }
    console.log('[WebSearch] Wikipedia returned 0 results')
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.warn('[WebSearch] Wikipedia failed:', errMsg)
    errors.push(`Wikipedia: ${errMsg}`)
  }

  // 5. 尝试 DuckDuckGo Instant Answer API (免费，支持 CORS)
  try {
    console.log('[WebSearch] Trying DuckDuckGo...')
    const ddgResult = await searchWithDuckDuckGoAPI(cleanQuery)
    if (ddgResult.results.length > 0) {
      console.log('[WebSearch] DuckDuckGo succeeded with', ddgResult.results.length, 'results')
      return ddgResult
    }
    console.log('[WebSearch] DuckDuckGo returned 0 results')
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.warn('[WebSearch] DuckDuckGo failed:', errMsg)
    errors.push(`DuckDuckGo: ${errMsg}`)
  }

  // === DuckDuckGo Proxy 已禁用 ===
  // corsproxy.io 在中国大陆返回 403，无法使用
  // 如需搜索功能，请正确配置 Bocha API: https://open.bochaai.com

  console.warn('[WebSearch] All search providers failed. Errors:', errors)
  return { results: [], provider: 'none', error: errors.join('; ') }
}

/**
 * Bing Web Search API (向后兼容)
 */
async function searchWithBing(query: string, apiKey: string): Promise<SearchResponse> {
  const endpoint = 'https://api.bing.microsoft.com/v7.0/search'
  const url = `${endpoint}?q=${encodeURIComponent(query)}&count=5&mkt=zh-CN`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Bing API HTTP ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  
  const results: SearchResult[] = []
  
  if (data.webPages && data.webPages.value) {
    for (const item of data.webPages.value) {
      results.push({
        title: item.name || '',
        url: item.url || '',
        snippet: item.snippet || ''
      })
    }
  }

  return { results: results.slice(0, 5), provider: 'Bing' }
}

/**
 * SerpAPI - 支持百度搜索!
 */
async function searchWithSerpAPI(query: string, apiKey: string): Promise<SearchResponse> {
  const url = `https://serpapi.com/search?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=5&hl=zh-cn`
  
  const response = await fetch(url, { method: 'GET' })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`SerpAPI HTTP ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  
  const results: SearchResult[] = []
  
  if (data.organic_results) {
    for (const item of data.organic_results) {
      results.push({
        title: item.title || '',
        url: item.link || '',
        snippet: item.snippet || ''
      })
    }
  }

  return { results: results.slice(0, 5), provider: 'SerpAPI' }
}

/**
 * 自定义搜索 API 端点
 */
async function searchWithCustomAPI(query: string, apiKey: string, apiUrl: string): Promise<SearchResponse> {
  if (apiUrl.includes('serpapi.com')) return searchWithSerpAPI(query, apiKey)
  if (apiUrl.includes('bing.microsoft.com') || apiKey.length > 20) return searchWithBing(query, apiKey)
  
  const url = `${apiUrl}?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=5`
  
  const response = await fetch(url, { method: 'GET' })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Custom API HTTP ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const results: SearchResult[] = []
  
  if (data.organic_results) {
    for (const item of data.organic_results) {
      results.push({ title: item.title || '', url: item.link || '', snippet: item.snippet || '' })
    }
  } else if (Array.isArray(data.results)) {
    for (const item of data.results) {
      results.push({ title: item.title || item.name || '', url: item.url || item.link || '', snippet: item.snippet || item.description || '' })
    }
  } else if (data.webPages?.value) {
    for (const item of data.webPages.value) {
      results.push({ title: item.name || '', url: item.url || '', snippet: item.snippet || '' })
    }
  }

  return { results: results.slice(0, 5), provider: 'Custom API' }
}

/**
 * 博查AI搜索 API (国内可用!)
 * 文档: https://open.bochaai.com/
 */
async function searchWithBochaAI(query: string, apiKey: string): Promise<SearchResponse> {
  const url = 'https://api.bochaai.com/v1/web-search'
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: query,
      count: 5,
      freshness: 'oneMonth',
      summary: true
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Bocha AI HTTP ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  
  const results: SearchResult[] = []
  
  if (data.webPages?.value) {
    for (const item of data.webPages.value) {
      results.push({
        title: item.name || '',
        url: it
