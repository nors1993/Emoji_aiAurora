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
 * 优先级: 自定义 API > Bocha AI > SerpAPI > Wikipedia > DuckDuckGo
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
      console.log('[WebSearch] Trying Bocha AI Search...', `API Key length: ${searchApiKey.length}`)
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

  // 6. 尝试使用 DuckDuckGo HTML 抓取 (通过 corsproxy)
  try {
    console.log('[WebSearch] Trying DuckDuckGo via proxy...')
    const ddgProxyResult = await searchWithDuckDuckGoProxy(cleanQuery)
    if (ddgProxyResult.results.length > 0) {
      console.log('[WebSearch] DuckDuckGo proxy succeeded with', ddgProxyResult.results.length, 'results')
      return ddgProxyResult
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    console.warn('[WebSearch] DuckDuckGo proxy failed:', errMsg)
    errors.push(`DuckDuckGo Proxy: ${errMsg}`)
  }

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
  
  const response = await fetch(url, {
    method: 'GET'
  })

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
  if (apiUrl.includes('serpapi.com')) {
    return searchWithSerpAPI(query, apiKey)
  }
  
  if (apiUrl.includes('bing.microsoft.com') || apiKey.length > 20) {
    return searchWithBing(query, apiKey)
  }
  
  const url = `${apiUrl}?q=${encodeURIComponent(query)}&api_key=${apiKey}&num=5`
  
  const response = await fetch(url, {
    method: 'GET'
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Custom API HTTP ${response.status}: ${errorText}`)
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
  } else if (Array.isArray(data.results)) {
    for (const item of data.results) {
      results.push({
        title: item.title || item.name || '',
        url: item.url || item.link || '',
        snippet: item.snippet || item.description || ''
      })
    }
  } else if (data.webPages?.value) {
    for (const item of data.webPages.value) {
      results.push({
        title: item.name || '',
        url: item.url || '',
        snippet: item.snippet || ''
      })
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
  const requestBody = {
    query: query,
    count: 5,
    freshness: 'oneMonth',
    summary: true
  }
  
  console.log('[Bocha AI] Request URL:', url)
  console.log('[Bocha AI] Request Body:', JSON.stringify(requestBody))
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  console.log('[Bocha AI] Response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.log('[Bocha AI] Error response:', errorText)
    throw new Error(`Bocha AI HTTP ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  console.log('[Bocha AI] Response data:', JSON.stringify(data).slice(0, 500))
  
  const results: SearchResult[] = []
  
  // Bocha AI 返回结构: { code: 200, data: { webPages: { value: [...] } } }
  const webPagesData = data.data?.webPages?.value
  if (webPagesData && Array.isArray(webPagesData)) {
    for (const item of webPagesData) {
      results.push({
        title: item.name || '',
        url: item.url || '',
        snippet: item.snippet || item.summary || ''
      })
    }
  }

  console.log('[Bocha AI] Parsed results count:', results.length)
  return { results: results.slice(0, 5), provider: 'Bocha AI' }
}

/**
 * 使用 CORS 代理访问 DuckDuckGo HTML
 */
async function searchWithDuckDuckGoProxy(query: string): Promise<SearchResponse> {
  const url = `https://corsproxy.io/?${encodeURIComponent(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`)}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })

  if (!response.ok) {
    throw new Error(`DuckDuckGo proxy HTTP ${response.status}`)
  }

  const html = await response.text()
  
  const results: SearchResult[] = []
  const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
  
  let match
  let count = 0
  while ((match = resultRegex.exec(html)) !== null && count < 5) {
    const url = match[1]
    const actualUrl = url.includes('uddg=') 
      ? decodeURIComponent(url.split('uddg=')[1].split('&')[0])
      : url
    
    const title = match[2].replace(/<[^>]+>/g, '').trim()
    const snippet = match[3].replace(/<[^>]+>/g, '').trim()
    
    if (title && actualUrl) {
      results.push({
        title,
        url: actualUrl,
        snippet: snippet || ''
      })
      count++
    }
  }

  return { results, provider: 'DuckDuckGo (proxy)' }
}

/**
 * Wikipedia API (免费且支持 CORS)
 */
async function searchWithWikipedia(query: string): Promise<SearchResponse> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&format=json&origin=*`
  
  const searchResponse = await fetch(searchUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  })

  if (!searchResponse.ok) {
    throw new Error(`Wikipedia search HTTP ${searchResponse.status}`)
  }

  const searchData = await searchResponse.json()
  const titles: string[] = searchData[1] || []
  const descriptions: string[] = searchData[2] || []
  const urls: string[] = searchData[3] || []
  
  const results: SearchResult[] = titles.map((title, index) => ({
    title: title || '',
    url: urls[index] || '',
    snippet: descriptions[index] || ''
  })).filter(r => r.title && r.url)

  return { results: results.slice(0, 5), provider: 'Wikipedia' }
}

/**
 * DuckDuckGo Instant Answer API
 */
async function searchWithDuckDuckGoAPI(query: string): Promise<SearchResponse> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&pretty=1`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`DuckDuckGo API HTTP ${response.status}`)
  }

  const data = await response.json()
  
  const results: SearchResult[] = []
  
  if (data.RelatedTopics) {
    for (const topic of data.RelatedTopics) {
      if (results.length >= 5) break
      
      if (topic.Text && topic.FirstURL) {
        results.push({
          title: topic.Text.split(' - ')[0] || topic.Text,
          url: topic.FirstURL,
          snippet: topic.Text
        })
      }
    }
  }
  
  if (results.length === 0 && data.AbstractText) {
    results.push({
      title: data.Heading || query,
      url: data.AbstractURL || '',
      snippet: data.AbstractText
    })
  }

  return { results, provider: 'DuckDuckGo' }
}

/**
 * 将搜索结果格式化为字符串，供 LLM 使用
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
 * 检查是否需要触发搜索 - 根据用户反馈关键词
 */
export function shouldTriggerAutoSearch(userMessage: string): boolean {
  const lowerMessage = userMessage.toLowerCase()
  
  const cnNegative = ['不对', '错了', '不是', '不正确', '错误', '假', '假的',
    '不是这样', '你说错了', '你搞错了', '重新回答', '再查', '查一下', '搜一下',
    '是真的吗', '确定吗', '是真的么', '可靠吗', '不对吧', '真的吗']
  
  const enNegative = ['wrong', 'incorrect', 'not right', 'false', 'fake',
    "that's wrong", "you're wrong", 'not correct', 'are you sure',
    'search', 'look it up', 'check', 'recheck', 'not sure']
  
  const allKeywords = [...cnNegative, ...enNegative]
  
  return allKeywords.some(keyword => lowerMessage.includes(keyword))
}
