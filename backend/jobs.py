"""Background extraction jobs.

Async in-process workers driven from a MongoDB job queue.
Each job:
1. Pulls companies from Companies House `advanced-search` in pages of 100.
2. Enriches each page with website/contact via scraper module.
3. Deduplicates by company_number.
4. Streams live progress into the job doc so the UI can poll.
"""

import asyncio
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from ch_client import CompaniesHouseClient
from scraper import enrich_batch
from regions import find_region

logger = logging.getLogger(__name__)

MAX_PER_JOB = 10000  # safety cap for MVP (self-hosted can raise via UI later)


class JobRunner:
    def __init__(self, db, ch: CompaniesHouseClient):
        self.db = db
        self.ch = ch
        self._tasks: dict[str, asyncio.Task] = {}

    async def create_job(
        self,
        user_id: str,
        region_id: str,
        filters: dict,
        limit: int = 500,
        name: Optional[str] = None,
    ) -> dict:
        region = find_region(region_id)
        if not region:
            raise ValueError(f"Unknown region: {region_id}")
        job_id = str(uuid.uuid4())
        doc = {
            "id": job_id,
            "name": name or f"{region['path']} extract",
            "user_id": user_id,
            "region_id": region_id,
            "region_name": region["path"],
            "region_location": region["location"],
            "filters": filters,
            "limit": min(limit, MAX_PER_JOB),
            "status": "queued",
            "progress": {"fetched": 0, "enriched": 0, "total_estimate": 0, "phase": "queued"},
            "companies": [],
            "no_website_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "started_at": None,
            "completed_at": None,
            "error": None,
        }
        await self.db.jobs.insert_one(doc)
        self._tasks[job_id] = asyncio.create_task(self._run(job_id))
        return {k: v for k, v in doc.items() if k != "companies"}

    async def _update(self, job_id: str, patch: dict, retries: int = 4):
        """Best-effort update for routine progress polling.

        A transient DNS/TLS blip shouldn't kill a long-running job just
        because a progress-percentage write failed. Retries with backoff,
        then logs and swallows the error if it still can't get through.
        """
        last_err = None
        for attempt in range(retries):
            try:
                await self.db.jobs.update_one({"id": job_id}, {"$set": patch})
                return
            except Exception as e:
                last_err = e
                logger.warning(
                    f"_update retry {attempt + 1}/{retries} for job {job_id}: {e}"
                )
                await asyncio.sleep(min(2 ** attempt, 10))
        logger.error(f"_update permanently failed for job {job_id}: {last_err}")
        # swallow it — a progress-update failure shouldn't kill the whole job

    async def _update_critical(self, job_id: str, patch: dict, retries: int = 6):
        """Stricter update for terminal state writes (completed/failed).

        These matter more, since if they silently fail the job stays stuck
        showing 'running' forever in the UI. Retries harder, then raises
        if it truly can't reach the database, so at least the crash gets
        logged clearly instead of vanishing.
        """
        last_err = None
        for attempt in range(retries):
            try:
                await self.db.jobs.update_one({"id": job_id}, {"$set": patch})
                return
            except Exception as e:
                last_err = e
                logger.warning(
                    f"_update_critical retry {attempt + 1}/{retries} for job {job_id}: {e}"
                )
                await asyncio.sleep(min(2 ** attempt, 15))
        logger.error(f"_update_critical permanently failed for job {job_id}: {last_err}")
        raise last_err

    async def _run(self, job_id: str):
        try:
            job = await self.db.jobs.find_one({"id": job_id})
            if not job:
                return
            filters = job["filters"] or {}
            await self._update(job_id, {
                "status": "running",
                "started_at": datetime.now(timezone.utc).isoformat(),
                "progress.phase": "fetching",
            })

            # Phase 1: fetch pages from Companies House
            collected: list[dict] = []
            seen: set[str] = set()
            start_index = 0
            page_size = 100
            limit = job["limit"]

            while len(collected) < limit:
                remaining = limit - len(collected)
                size = min(page_size, remaining)
                try:
                    resp = await self.ch.advanced_search(
                        location=job["region_location"],
                        sic_codes=filters.get("sic_codes") or None,
                        company_status=filters.get("company_status") or None,
                        company_name_includes=filters.get("name_includes") or None,
                        incorporated_from=filters.get("incorporated_from") or None,
                        incorporated_to=filters.get("incorporated_to") or None,
                        start_index=start_index,
                        size=size,
                    )
                except Exception as e:
                    logger.exception("CH search failed")
                    await self._update_critical(job_id, {
                        "status": "failed",
                        "error": f"Companies House API error: {e}",
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                    })
                    return

                items = resp.get("items", []) or []
                total_est = resp.get("hits") or resp.get("total_results") or resp.get("top_hit", {}).get("total_results") or 0
                if not items:
                    break

                for it in items:
                    cn = it.get("company_number")
                    if not cn or cn in seen:
                        continue
                    seen.add(cn)
                    collected.append({
                        "company_number": cn,
                        "company_name": it.get("company_name"),
                        "company_status": it.get("company_status"),
                        "company_type": it.get("company_type"),
                        "date_of_creation": it.get("date_of_creation"),
                        "sic_codes": it.get("sic_codes", []),
                        "registered_address": it.get("registered_office_address", {}),
                        "region": job["region_name"],
                    })

                start_index += len(items)
                await self._update(job_id, {
                    "progress.fetched": len(collected),
                    "progress.total_estimate": total_est or len(collected),
                    "progress.phase": "fetching",
                })
                if len(items) < size:
                    break

            # Phase 2: enrichment in chunks of 25
            await self._update(job_id, {"progress.phase": "enriching"})
            chunk = 25
            enriched_count = 0
            no_web = 0
            for i in range(0, len(collected), chunk):
                batch = collected[i:i + chunk]
                names = [c["company_name"] or "" for c in batch]
                enrichments = await enrich_batch(names, concurrency=6)
                for c, e in zip(batch, enrichments):
                    c["website"] = e.get("website")
                    c["has_website"] = bool(e.get("has_website"))
                    c["email"] = e.get("email")
                    c["phone"] = e.get("phone")
                    if not c["has_website"]:
                        no_web += 1
                enriched_count += len(batch)
                await self._update(job_id, {
                    "progress.enriched": enriched_count,
                    "no_website_count": no_web,
                })

            # Filter by has_website if requested
            website_filter = (filters.get("website_filter") or "all").lower()
            if website_filter == "no_website":
                collected = [c for c in collected if not c["has_website"]]
            elif website_filter == "has_website":
                collected = [c for c in collected if c["has_website"]]

            await self._update_critical(job_id, {
                "status": "completed",
                "companies": collected,
                "no_website_count": sum(1 for c in collected if not c["has_website"]),
                "progress.phase": "completed",
                "progress.enriched": enriched_count,
                "progress.fetched": len(collected),
                "completed_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.exception("Job runner crashed")
            try:
                await self._update_critical(job_id, {
                    "status": "failed",
                    "error": str(e),
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                logger.error(
                    f"Could not mark job {job_id} as failed — database unreachable"
                )
        finally:
            self._tasks.pop(job_id, None)