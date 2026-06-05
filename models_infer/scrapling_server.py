"""
Scrapling Web Search Server — DuckDuckGo search via Scrapling FetcherSession.

Uses Scrapling's adaptive HTTP fetching to scrape DuckDuckGo HTML search results.
No API key required — free and open web search.

REST endpoint:
  POST /v1/search  (JSON body: {query: str, count?: int})
  GET  /health

Environment variables:
  SCRAPLING_PORT         — listen port (default: 8003)
  SCRAPLING_API_KEY      — API key for Bearer auth (default: sk-scrapling-demo)
  SCRAPLING_TIMEOUT      — request timeout in seconds (default: 15)

Start:
  .venv/bin/python models_infer/scrapling_server.py
"""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

API_KEY = os.getenv("SCRAPLING_API_KEY", "sk-scrapling-demo")
PORT = int(os.getenv("SCRAPLING_PORT", "8003"))
TIMEOUT = int(os.getenv("SCRAPLING_TIMEOUT", "15"))


def _verify_auth(authorization: Optional[str]) -> None:
    """Verify Bearer token authorization."""
    if authorization is None:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or token != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")


async def _scrape_duckduckgo(query: str, count: int = 5) -> list[dict]:
    """
    Scrape DuckDuckGo HTML search results using Scrapling FetcherSession.
    Returns list of {title, url, snippet} dicts.
    """
    import warnings
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=DeprecationWarning)

        from scrapling.fetchers import FetcherSession

    encoded = __import__("urllib.parse", fromlist=["quote"]).quote(query)
    url = f"https://html.duckduckgo.com/html/?q={encoded}"

    loop = asyncio.get_running_loop()
    results: list[dict] = []

    def _sync_scrape() -> list[dict]:
        with FetcherSession(
            impersonate="chrome",
            timeout=TIMEOUT,
        ) as session:
            page = session.get(
                url,
                stealthy_headers=True,
            )

            if page.status != 200:
                return []

            # Parse result blocks: .result elements contain title, link, snippet
            result_blocks = page.css(".result")
            out: list[dict] = []
            for block in result_blocks:
                if len(out) >= count:
                    break
                # Title and URL
                title_el = block.css(".result__a").first
                title = title_el.get_all_text().strip() if title_el else ""
                href = title_el.attrib.get("href", "") if title_el else ""

                # Clean DuckDuckGo redirect URLs
                actual_url = href
                if "uddg=" in href:
                    actual_url = __import__("urllib.parse", fromlist=["unquote"]).unquote(
                        href.split("uddg=")[1].split("&")[0]
                    )

                # Snippet
                snippet_el = block.css(".result__snippet").first
                snippet = snippet_el.get_all_text().strip() if snippet_el else ""

                if title and actual_url:
                    out.append({
                        "title": title,
                        "url": actual_url,
                        "snippet": snippet,
                    })

            return out

    try:
        results = await asyncio.wait_for(
            loop.run_in_executor(None, _sync_scrape),
            timeout=TIMEOUT + 5,
        )
    except asyncio.TimeoutError:
        pass  # Return empty results on timeout
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Scrapling error: {str(e)}")

    return results


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Pre-warm: verify Scrapling is importable."""
    try:
        import scrapling  # noqa: F401
        print(f"[Scrapling Server] Scrapling available, listening on port {PORT}")
    except ImportError:
        print("[Scrapling Server] WARNING: Scrapling not installed. "
              "Run: pip install 'scrapling[all]>=0.4.8'")
    yield


app = FastAPI(title="Scrapling Web Search Server", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "scrapling-search"}


@app.post("/v1/search")
async def search(
    body: dict,
    authorization: Optional[str] = Header(None),
):
    """Search the web via DuckDuckGo (scraped by Scrapling)."""
    _verify_auth(authorization)

    query = (body.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Empty query")

    count = min(int(body.get("count", 5)), 10)

    results = await _scrape_duckduckgo(query, count)

    return JSONResponse({
        "results": results,
        "provider": "DuckDuckGo (Scrapling)",
        "query": query,
    })


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
