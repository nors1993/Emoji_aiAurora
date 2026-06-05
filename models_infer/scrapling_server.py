"""
Scrapling Web Search Server — DuckDuckGo search + RSS news aggregation.

General search: Scrapling FetcherSession → httpx fallback → DuckDuckGo HTML
News search:    RSS feeds (BBC, Reuters, Guardian, etc.) + DuckDuckGo fallback

No API key required.

Endpoints:
  POST /v1/search       — general web search
  POST /v1/search/news  — news search (RSS + DuckDuckGo hybrid)
  GET  /health

Deps: pip install httpx defusedxml fastapi uvicorn  (scrapling optional)
Start: python models_infer/scrapling_server.py
"""

from __future__ import annotations

import asyncio
import html as html_module
import os
import re
import urllib.parse
import warnings
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

import uvicorn
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

API_KEY = os.getenv("SCRAPLING_API_KEY", "sk-scrapling-demo")
PORT = int(os.getenv("SCRAPLING_PORT", "8003"))
TIMEOUT = int(os.getenv("SCRAPLING_TIMEOUT", "20"))

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
]
_ua_index = 0
def _next_ua() -> str:
    global _ua_index
    ua = USER_AGENTS[_ua_index % len(USER_AGENTS)]
    _ua_index += 1
    return ua

def _verify_auth(authorization: Optional[str]) -> None:
    if authorization is None:
        raise HTTPException(401, detail="Missing Authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token != API_KEY:
        raise HTTPException(403, detail="Invalid API key")


# ── General search (Scrapling + httpx fallback) ────────────────────

async def _scrape_via_scrapling(query: str, count: int = 5) -> list[dict]:
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=DeprecationWarning)
        from scrapling.fetchers import FetcherSession  # type: ignore
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    loop = asyncio.get_running_loop()
    def _sync() -> list[dict]:
        with FetcherSession(impersonate="chrome", timeout=TIMEOUT) as s:
            p = s.get(url, stealthy_headers=True)
            if p.status != 200: return []
            out = []
            for b in p.css(".result"):
                if len(out) >= count: break
                t = b.css(".result__a").first
                title = t.get_all_text().strip() if t else ""
                href = t.attrib.get("href","") if t else ""
                u = urllib.parse.unquote(href.split("uddg=")[1].split("&")[0]) if "uddg=" in href else href
                sn = b.css(".result__snippet").first
                snippet = sn.get_all_text().strip() if sn else ""
                if title and u: out.append({"title": title, "url": u, "snippet": snippet})
            return out
    try: return await asyncio.wait_for(loop.run_in_executor(None, _sync), timeout=TIMEOUT+5)
    except Exception: return []

async def _fetch_ddg_html(query: str) -> str | None:
    try:
        import httpx
    except ImportError:
        return None
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as c:
            r = await c.get(url, headers={"User-Agent": _next_ua(), "Accept": "text/html"})
        return r.text if r.status_code == 200 else None
    except Exception:
        return None

def _parse_ddg_html(html: str, count: int) -> list[dict]:
    results = []
    blocks = re.split(r'<div[^>]*class="[^"]*\bresult\b[^"]*"[^>]*>', html, flags=re.IGNORECASE)
    for block in blocks[1:]:
        if len(results) >= count: break
        tm = re.search(r'<a[^>]*class="result__a"[^>]*>(.*?)</a>', block, re.IGNORECASE | re.DOTALL)
        if not tm: continue
        title = html_module.unescape(re.sub(r'<[^>]+>', '', tm.group(1)).strip())
        hm = re.search(r'<a[^>]*class="result__a"[^>]*href="([^"]*)"', block, re.IGNORECASE)
        url = ""
        if hm:
            h = hm.group(1)
            url = urllib.parse.unquote(h.split("uddg=")[1].split("&")[0]) if "uddg=" in h else h
        sm = re.search(r'class="result__snippet"[^>]*>(.*?)</(?:span|a)', block, re.IGNORECASE | re.DOTALL)
        snippet = html_module.unescape(re.sub(r'<[^>]+>', '', sm.group(1)).strip()) if sm else ""
        if title and url:
            results.append({"title": title, "url": url, "snippet": snippet})
    return results[:count]


# ── News search: RSS feed aggregation ──────────────────────────────
# RSS gives us real, article-level news without any API key.

NEWS_RSS_FEEDS: list[dict] = [
    {"name": "BBC Top Stories",   "url": "https://feeds.bbci.co.uk/news/rss.xml", "lang": "en"},
    {"name": "BBC World",         "url": "https://feeds.bbci.co.uk/news/world/rss.xml", "lang": "en"},
    {"name": "BBC Technology",    "url": "https://feeds.bbci.co.uk/news/technology/rss.xml", "lang": "en"},
    {"name": "BBC Business",      "url": "https://feeds.bbci.co.uk/news/business/rss.xml", "lang": "en"},
    {"name": "Guardian World",    "url": "https://www.theguardian.com/world/rss", "lang": "en"},
    {"name": "Guardian Tech",     "url": "https://www.theguardian.com/technology/rss", "lang": "en"},
    {"name": "NPR News",          "url": "https://feeds.npr.org/1001/rss.xml", "lang": "en"},
    {"name": "Reuters",           "url": "https://www.reutersagency.com/feed/", "lang": "en"},
    {"name": "AP Top News",       "url": "https://rsshub.app/apnews/topics/apf-topnews", "lang": "en"},
    {"name": "CNN Top Stories",   "url": "https://rsshub.app/cnn/top-stories", "lang": "en"},
    {"name": "CNBC Top News",     "url": "https://rsshub.app/cnbc/top-news", "lang": "en"},
    {"name": "新华网",            "url": "https://rsshub.app/xinhua/news", "lang": "zh"},
    {"name": "环球网",            "url": "https://rsshub.app/huanqiu/news", "lang": "zh"},
    {"name": "新浪热点",          "url": "https://rsshub.app/sina/hotnews", "lang": "zh"},
]

# Fallback: direct RSS parsing without RSSHub
DIRECT_RSS = [
    {"name": "BBC Top",  "url": "https://feeds.bbci.co.uk/news/rss.xml"},
    {"name": "BBC World","url": "https://feeds.bbci.co.uk/news/world/rss.xml"},
    {"name": "Guardian", "url": "https://www.theguardian.com/world/rss"},
    {"name": "NPR",      "url": "https://feeds.npr.org/1001/rss.xml"},
]


def _parse_rss(xml: str) -> list[dict]:
    """Parse RSS XML into {title, url, snippet, date} list. No deps needed."""
    items = []
    # Extract <item> blocks
    for item in re.findall(r'<item>(.*?)</item>', xml, re.IGNORECASE | re.DOTALL):
        title = html_module.unescape(
            re.sub(r'<[^>]+>', '', (re.search(r'<title>(.*?)</title>', item, re.IGNORECASE | re.DOTALL) or ['', ''])[1])
        ).strip()
        link = (re.search(r'<link>(.*?)</link>', item, re.IGNORECASE | re.DOTALL) or ['', ''])[1].strip()
        desc = html_module.unescape(
            re.sub(r'<[^>]+>', '', (re.search(r'<description>(.*?)</description>', item, re.IGNORECASE | re.DOTALL) or ['', ''])[1])
        ).strip()[:200]
        date_str = (re.search(r'<pubDate>(.*?)</pubDate>', item, re.IGNORECASE | re.DOTALL) or ['', ''])[1].strip()
        if title and link:
            items.append({"title": title, "url": link, "snippet": desc, "date": date_str})
    # Try Atom format if no RSS items
    if not items:
        for entry in re.findall(r'<entry>(.*?)</entry>', xml, re.IGNORECASE | re.DOTALL):
            title = html_module.unescape(
                re.sub(r'<[^>]+>', '', (re.search(r'<title>(.*?)</title>', entry, re.IGNORECASE | re.DOTALL) or ['', ''])[1])
            ).strip()
            link_m = re.search(r'<link[^>]*href="([^"]*)"', entry, re.IGNORECASE)
            link = link_m.group(1) if link_m else ""
            desc = html_module.unescape(
                re.sub(r'<[^>]+>', '', (re.search(r'<summary>(.*?)</summary>', entry, re.IGNORECASE | re.DOTALL) or ['', ''])[1])
            ).strip()[:200]
            if title and link:
                items.append({"title": title, "url": link, "snippet": desc, "date": ""})
    return items


async def _fetch_rss(feed_url: str) -> str | None:
    """Fetch an RSS feed URL."""
    try:
        import httpx
    except ImportError:
        return None
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True) as c:
            r = await c.get(feed_url, headers={"User-Agent": _next_ua()})
        return r.text if r.status_code == 200 else None
    except Exception:
        return None


async def _fetch_news_from_rss(count: int = 15) -> list[dict]:
    """
    Fetch news from RSS feeds. Tries direct BBC/Guardian/NPR RSS first,
    then falls back to RSSHub for more sources.
    """
    all_items: list[dict] = []
    seen_urls: set[str] = set()

    # Phase 1: Direct RSS (most reliable)
    for feed in DIRECT_RSS:
        xml = await _fetch_rss(feed["url"])
        if xml:
            for item in _parse_rss(xml):
                url = item["url"].split("?")[0]  # deduplicate by base URL
                if url not in seen_urls:
                    seen_urls.add(url)
                    all_items.append(item)

    # Phase 2: RSSHub (if direct RSS didn't give enough)
    if len(all_items) < count:
        for feed in NEWS_RSS_FEEDS:
            if len(all_items) >= count * 2:
                break
            if feed["url"] in [f["url"] for f in DIRECT_RSS]:
                continue  # already fetched
            xml = await _fetch_rss(feed["url"])
            if xml:
                for item in _parse_rss(xml):
                    url = item["url"].split("?")[0]
                    if url not in seen_urls:
                        seen_urls.add(url)
                        all_items.append(item)

    # Sort by recency (items with dates first, then by date)
    def _sort_key(item: dict) -> tuple:
        d = item.get("date", "")
        if d:
            try:
                dt = datetime.strptime(d, "%a, %d %b %Y %H:%M:%S %z")
                return (0, -dt.timestamp())
            except (ValueError, TypeError):
                try:
                    dt = datetime.fromisoformat(d.replace("Z", "+00:00"))
                    return (0, -dt.timestamp())
                except (ValueError, TypeError):
                    pass
        return (1, 0)

    all_items.sort(key=_sort_key)

    # Return as search-result format
    results = []
    for item in all_items:
        if len(results) >= count:
            break
        results.append({
            "title": item["title"],
            "url": item["url"],
            "snippet": item.get("snippet", ""),
        })
    return results


# ── News search: DuckDuckGo fallback ───────────────────────────────

async def _scrape_news_ddg(query: str, count: int = 10) -> list[dict]:
    """Fallback: search DuckDuckGo with news-enriched query."""
    enriched = f"{query} {datetime.now().year} news"
    # Try Scrapling
    try:
        r = await _scrape_via_scrapling(enriched, count)
        if r: return r
    except Exception:
        pass
    # Fallback httpx
    html = await _fetch_ddg_html(enriched)
    if html:
        r = _parse_ddg_html(html, count)
        if r: return r
    return []


# ── unified handlers ───────────────────────────────────────────────

async def search_duckduckgo(query: str, count: int = 5) -> list[dict]:
    try:
        r = await _scrape_via_scrapling(query, count)
        if r: return r
    except Exception:
        pass
    html = await _fetch_ddg_html(query)
    if html:
        r = _parse_ddg_html(html, count)
        if r: return r
    return []


async def search_news(query: str, count: int = 15) -> list[dict]:
    """
    News search strategy:
    1. RSS feed aggregation (BBC, Guardian, NPR, RSSHub) — returns real articles
    2. DuckDuckGo with enriched query (fallback)
    """
    results = await _fetch_news_from_rss(count)
    if results:
        return results
    return await _scrape_news_ddg(query, count)


# ── FastAPI ────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        import scrapling  # noqa: F401
        print(f"[Scrapling] Scrapling available, port {PORT}")
    except ImportError:
        print("[Scrapling] Scrapling not installed — will use httpx fallback")
    try:
        import httpx  # noqa: F401
        print("[Scrapling] httpx available")
    except ImportError:
        print("[Scrapling] httpx not installed!")
    yield


app = FastAPI(title="Scrapling Web Search Server", version="0.5.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "scrapling-search", "version": "0.5.0"}


@app.post("/v1/search")
async def search(body: dict, authorization: Optional[str] = Header(None)):
    _verify_auth(authorization)
    q = (body.get("query") or "").strip()
    if not q: raise HTTPException(400, "Empty query")
    c = min(int(body.get("count", 5)), 15)
    r = await search_duckduckgo(q, c)
    return JSONResponse({"results": r, "provider": "DuckDuckGo", "query": q})


@app.post("/v1/search/news")
async def search_news_endpoint(body: dict, authorization: Optional[str] = Header(None)):
    """
    News search. Aggregates RSS feeds from BBC, Guardian, NPR, etc.
    Returns real article-level results. No API key needed.
    """
    _verify_auth(authorization)
    q = (body.get("query") or "").strip()
    if not q: raise HTTPException(400, "Empty query")
    c = min(int(body.get("count", 5)), 30)
    r = await search_news(q, c)
    return JSONResponse({"results": r, "provider": "RSS + DuckDuckGo", "query": q})


@app.post("/v1/search/news/hot")
async def hot_news(body: dict, authorization: Optional[str] = Header(None)):
    """
    Get hot/trending news. Ignores query, returns top articles from RSS feeds.
    Use this for "今日热点" / "top news today" type requests.
    """
    _verify_auth(authorization)
    c = min(int(body.get("count", 10)), 30)
    r = await _fetch_news_from_rss(c)
    return JSONResponse({"results": r, "provider": "RSS Aggregator", "type": "hot"})




# ── Crypto Liquidation Data (Binance public API) ───────────────────


async def _fetch_binance_tickers() -> list[dict]:
    """Fetch 24hr ticker data from Binance Futures public API. No key needed."""
    import httpx
    url = "https://fapi.binance.com/fapi/v1/ticker/24hr"
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(url, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code == 200:
            return r.json()
    except Exception:
        return []


async def _get_liquidation_data() -> list[dict]:
    """
    Analyze Binance futures 24hr data to identify probable liquidation events.
    Returns: list of {title, url, snippet} in web search result format.
    """
    tickers = await _fetch_binance_tickers()
    if not tickers:
        return []

    # Sort by price change ascending (biggest losers first)
    tickers.sort(key=lambda x: float(x.get("priceChangePercent", 0)))
    results = []

    # Filter to only significant movers (|change| > 2%)
    significant = [t for t in tickers if abs(float(t.get("priceChangePercent", 0))) > 2]
    losers = [t for t in significant if float(t["priceChangePercent"]) < 0]
    gainers = [t for t in significant if float(t["priceChangePercent"]) > 0]

    # Top losers (liquidation candidates)
    for t in losers[:15]:
        sym = t["symbol"]
        pct = float(t["priceChangePercent"])
        vol = float(t.get("volume", 0))
        low = float(t.get("lowPrice", 0))
        high = float(t.get("highPrice", 0))
        results.append({
            "title": f"[爆仓] {sym} 24h跌幅 {pct:.2f}%",
            "url": f"https://www.binance.com/en/futures/{sym.replace('USDT', 'USDT')}",
            "snippet": (
                f"合約: {sym} | 跌幅: {pct:.2f}% | 成交量: {vol:.0f} | "
                f"24h最低: ${low:.2f} | 24h最高: ${high:.2f} | "
                f"高跌幅通常伴随大规模爆仓"
            ),
        })

    # Summary entry
    total_liquidation_vol = sum(
        float(t.get("quoteVolume", 0)) for t in losers[:15]
    )
    results.insert(0, {
        "title": f"24小时爆仓概况 — {len(losers)}个合约跌幅超2%",
        "url": "https://www.binance.com/en/futures/BTCUSDT",
        "snippet": (
            f"过去24小时，加密货币市场共有{len(losers)}个合约跌幅超过2%。"
            f"预估爆仓最严重的合约: {losers[0]['symbol']}({float(losers[0]['priceChangePercent']):.2f}%), "
            f"{losers[1]['symbol']}({float(losers[1]['priceChangePercent']):.2f}%), "
            f"{losers[2]['symbol']}({float(losers[2]['priceChangePercent']):.2f}%)"
        ),
    })

    # Top gainers for context
    gainer_summary = ", ".join(
        f"{t['symbol']}(+{float(t['priceChangePercent']):.1f}%)"
        for t in gainers[:5]
    )
    results.append({
        "title": f"24h涨幅领先: {gainers[:3]}",
        "url": "https://www.binance.com/en/futures",
        "snippet": f"涨幅最大合约: {gainer_summary}",
    })

    return results


@app.post("/v1/search/crypto/liquidation")
async def crypto_liquidation(body: dict, authorization: Optional[str] = Header(None)):
    """
    Cryptocurrency liquidation data from Binance public API.
    No API key required. Returns 24h price movers as liquidation proxy data.
    """
    _verify_auth(authorization)
    count = min(int(body.get("count", 10)), 20)
    results = await _get_liquidation_data()
    return JSONResponse({
        "results": results[:count],
        "provider": "Binance Futures (Public API)",
        "data_type": "liquidation_analysis",
    })


# ── Health check update ────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT)
