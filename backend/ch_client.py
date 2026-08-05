"""Companies House REST API async client with rate limiting & retry.

Docs: https://developer.company-information.service.gov.uk/
- Auth: HTTP Basic with API key as username, blank password.
- Rate limit: 600 requests / 5 minutes per key (returns 429).
- Advanced search paginates via `start_index` + `size` (1..5000).
"""

import asyncio
import random
import logging
from typing import Any, Optional

import httpx
from aiolimiter import AsyncLimiter

logger = logging.getLogger(__name__)

BASE_URL = "https://api.company-information.service.gov.uk"


class CompaniesHouseClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        # 600 requests per 5 minute (300s) window.
        self.limiter = AsyncLimiter(600, 300)
        self.client = httpx.AsyncClient(
            base_url=BASE_URL,
            auth=(api_key, ""),
            timeout=httpx.Timeout(30.0),
            headers={"Accept": "application/json"},
        )

    async def _get(self, path: str, params: Optional[dict] = None) -> dict:
        last_exc: Optional[Exception] = None
        for attempt in range(5):
            try:
                async with self.limiter:
                    resp = await self.client.get(path, params=params)
                if resp.status_code == 429 or resp.status_code >= 500:
                    retry_after = resp.headers.get("Retry-After")
                    delay = float(retry_after) if retry_after else min(2 ** attempt, 30) + random.random()
                    logger.warning(f"CH API {resp.status_code} - retrying in {delay:.1f}s (attempt {attempt+1})")
                    await asyncio.sleep(delay)
                    continue
                if resp.status_code == 404:
                    return {}
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPError as e:
                last_exc = e
                await asyncio.sleep(min(2 ** attempt, 15) + random.random())
        if last_exc:
            raise last_exc
        raise RuntimeError("Companies House request failed after 5 retries")

    async def advanced_search(
        self,
        location: Optional[str] = None,
        sic_codes: Optional[list[str]] = None,
        company_status: Optional[list[str]] = None,
        company_name_includes: Optional[str] = None,
        incorporated_from: Optional[str] = None,  # YYYY-MM-DD
        incorporated_to: Optional[str] = None,
        start_index: int = 0,
        size: int = 100,
    ) -> dict:
        params: dict[str, Any] = {"size": min(size, 5000), "start_index": start_index}
        if location:
            params["location"] = location
        if sic_codes:
            params["sic_codes"] = ",".join(sic_codes)
        if company_status:
            params["company_status"] = ",".join(company_status)
        if company_name_includes:
            params["company_name_includes"] = company_name_includes
        if incorporated_from:
            params["incorporated_from"] = incorporated_from
        if incorporated_to:
            params["incorporated_to"] = incorporated_to
        return await self._get("/advanced-search/companies", params)

    async def company_profile(self, company_number: str) -> dict:
        return await self._get(f"/company/{company_number}")

    async def officers(self, company_number: str, size: int = 35) -> dict:
        return await self._get(
            f"/company/{company_number}/officers",
            {"items_per_page": size, "start_index": 0},
        )

    async def close(self):
        await self.client.aclose()
