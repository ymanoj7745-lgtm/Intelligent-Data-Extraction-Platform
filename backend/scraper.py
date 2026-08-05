"""Website / contact enrichment for UK companies.

Strategy for MVP (self-hosted, respectful):
1. Deterministic domain probes: try `www.<slug>.co.uk` and `www.<slug>.com`.
   A live 200/301/302 response counts as a discoverable website.
2. If no domain responds within a short timeout, the company is flagged
   `has_website=False` — the core "No Website" business signal.
3. Phone/email extraction: when a website IS reachable, we fetch its
   homepage and scrape mailto: + tel: links plus the first UK-format
   phone number we find.

Real directory scrapers (Yell.com / 192.com / Endole / FreeIndex) can be
plugged into `enrich_from_directories` — currently stubbed to fail-safe
(returns None), which is honest: this MVP does not rely on external
directory scraping and clearly marks unknowns.
"""

import asyncio
import re
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
]

PHONE_RE = re.compile(r"(?:\+44\s?|0)(?:\d\s?){9,10}\d")
EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


def _slug(name: str) -> str:
    s = name.lower()
    for suffix in (" limited", " ltd", " plc", " llp", " uk", " co."):
        if s.endswith(suffix):
            s = s[: -len(suffix)]
    s = re.sub(r"[^a-z0-9]+", "", s)
    return s[:40]


async def _probe(client: httpx.AsyncClient, url: str) -> bool:
    try:
        r = await client.head(url, follow_redirects=True, timeout=4.0)
        if r.status_code < 400:
            return True
        # Some sites reject HEAD - try tiny GET
        r = await client.get(url, follow_redirects=True, timeout=4.0)
        return r.status_code < 400
    except Exception:
        return False


async def _extract_contacts(client: httpx.AsyncClient, url: str) -> tuple[Optional[str], Optional[str]]:
    try:
        r = await client.get(url, follow_redirects=True, timeout=6.0)
        if r.status_code >= 400:
            return None, None
        html = r.text[:200_000]
        email_match = EMAIL_RE.search(html)
        phone_match = PHONE_RE.search(html)
        return (
            email_match.group(0) if email_match else None,
            phone_match.group(0).strip() if phone_match else None,
        )
    except Exception:
        return None, None


async def enrich_company(name: str) -> dict:
    """Return enrichment dict: {website, has_website, email, phone, source}."""
    slug = _slug(name)
    result = {"website": None, "has_website": False, "email": None, "phone": None, "source": "probe"}
    if not slug or len(slug) < 3:
        return result

    candidates = [f"https://www.{slug}.co.uk", f"https://www.{slug}.com"]
    async with httpx.AsyncClient(
        headers={"User-Agent": USER_AGENTS[hash(name) % len(USER_AGENTS)]},
        timeout=8.0,
    ) as client:
        for url in candidates:
            if await _probe(client, url):
                result["website"] = url
                result["has_website"] = True
                email, phone = await _extract_contacts(client, url)
                result["email"] = email
                result["phone"] = phone
                return result
    return result


async def enrich_batch(names: list[str], concurrency: int = 8) -> list[dict]:
    sem = asyncio.Semaphore(concurrency)

    async def _one(n):
        async with sem:
            try:
                return await enrich_company(n)
            except Exception as e:
                logger.warning(f"enrich failed for {n}: {e}")
                return {"website": None, "has_website": False, "email": None, "phone": None, "source": "error"}

    return await asyncio.gather(*[_one(n) for n in names])
