from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from io import BytesIO

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from auth import build_auth_router, seed_admin
from ch_client import CompaniesHouseClient
from jobs import JobRunner
from regions import UK_REGIONS, find_region
from excel_export import build_xlsx

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- DB ---
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

# --- CH client & job runner ---
ch = CompaniesHouseClient(os.environ.get('COMPANIES_HOUSE_API_KEY', ''))
runner = JobRunner(db, ch)
scheduler = AsyncIOScheduler(timezone="UTC")

app = FastAPI(title="UK Companies Data Extractor")

# --- Startup / shutdown ---
@app.on_event("startup")
async def _startup():
    await db.users.create_index("email", unique=True)
    await db.jobs.create_index("id", unique=True)
    await db.jobs.create_index("created_at")
    await db.schedules.create_index("id", unique=True)
    await seed_admin(db)
    # Write test creds for testing agent
    try:
        Path("/app/memory").mkdir(exist_ok=True, parents=True)
        Path("/app/memory/test_credentials.md").write_text(
            f"""# Test Credentials

## Admin
- Email: {os.environ.get('ADMIN_EMAIL')}
- Password: {os.environ.get('ADMIN_PASSWORD')}
- Role: admin

## Auth endpoints
- POST /api/auth/login
- GET  /api/auth/me
- GET  /api/auth/users (admin)
- POST /api/auth/users (admin)
"""
        )
    except Exception as e:
        logger.warning(f"could not write test_credentials: {e}")

    # Load & schedule active recurring extractions
    scheduler.start()
    async for sch in db.schedules.find({"active": True}):
        _schedule_job(sch)


@app.on_event("shutdown")
async def _shutdown():
    scheduler.shutdown(wait=False)
    await ch.close()
    client.close()


# --- Auth ---
auth_router = build_auth_router(db)
app.include_router(auth_router)
get_current_user = auth_router.get_current_user  # type: ignore
require_admin = auth_router.require_admin  # type: ignore

# --- API router ---
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"service": "uk-companies-extractor", "status": "ok"}


@api.get("/regions")
async def get_regions(user: dict = Depends(get_current_user)):
    return UK_REGIONS


# --- Job endpoints ---
class JobCreateIn(BaseModel):
    region_id: str
    name: Optional[str] = None
    limit: int = 500
    filters: dict = {}


@api.post("/jobs")
async def create_job(payload: JobCreateIn, user: dict = Depends(get_current_user)):
    try:
        job = await runner.create_job(
            user_id=user["id"],
            region_id=payload.region_id,
            filters=payload.filters,
            limit=payload.limit,
            name=payload.name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return job


@api.get("/jobs")
async def list_jobs(user: dict = Depends(get_current_user), limit: int = 50):
    jobs = await db.jobs.find(
        {}, {"_id": 0, "companies": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return jobs


@api.get("/jobs/{job_id}")
async def get_job(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0, "companies": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@api.get("/jobs/{job_id}/companies")
async def get_job_companies(
    job_id: str,
    user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort: str = "company_name",
    order: str = "asc",
    website_filter: str = "all",  # all | has | none
    q: Optional[str] = None,
):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    companies = job.get("companies", []) or []

    if website_filter == "has":
        companies = [c for c in companies if c.get("has_website")]
    elif website_filter == "none":
        companies = [c for c in companies if not c.get("has_website")]
    if q:
        ql = q.lower()
        companies = [c for c in companies if ql in (c.get("company_name") or "").lower()
                     or ql in (c.get("company_number") or "").lower()]

    reverse = order == "desc"
    companies = sorted(companies, key=lambda c: (c.get(sort) or ""), reverse=reverse)

    total = len(companies)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": companies[start:end],
    }


@api.get("/jobs/{job_id}/export")
async def export_job(job_id: str, user: dict = Depends(get_current_user)):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job not completed")
    xlsx = build_xlsx(job.get("companies", []), job)
    filename = f"companies_{job['region_id']}_{job['id'][:8]}.xlsx"
    return StreamingResponse(
        BytesIO(xlsx),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api.delete("/jobs/{job_id}")
async def delete_job(job_id: str, user: dict = Depends(get_current_user)):
    r = await db.jobs.delete_one({"id": job_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"ok": True}


# --- Schedules (recurring extractions) ---
class ScheduleIn(BaseModel):
    name: str
    region_id: str
    cadence: str  # daily | weekly | monthly
    filters: dict = {}
    limit: int = 500
    active: bool = True


def _cron_for(cadence: str) -> CronTrigger:
    cadence = cadence.lower()
    if cadence == "daily":
        return CronTrigger(hour=2, minute=0)
    if cadence == "weekly":
        return CronTrigger(day_of_week="mon", hour=2, minute=0)
    if cadence == "monthly":
        return CronTrigger(day=1, hour=2, minute=0)
    raise ValueError("cadence must be daily|weekly|monthly")


async def _run_scheduled(schedule_id: str):
    sch = await db.schedules.find_one({"id": schedule_id})
    if not sch or not sch.get("active"):
        return
    await runner.create_job(
        user_id=sch["user_id"],
        region_id=sch["region_id"],
        filters=sch["filters"],
        limit=sch["limit"],
        name=f"[Scheduled] {sch['name']}",
    )
    await db.schedules.update_one(
        {"id": schedule_id},
        {"$set": {"last_run_at": datetime.now(timezone.utc).isoformat()}},
    )


def _schedule_job(sch: dict):
    try:
        scheduler.add_job(
            _run_scheduled,
            _cron_for(sch["cadence"]),
            args=[sch["id"]],
            id=sch["id"],
            replace_existing=True,
        )
    except Exception as e:
        logger.warning(f"could not schedule {sch['id']}: {e}")


@api.get("/schedules")
async def list_schedules(user: dict = Depends(get_current_user)):
    return await db.schedules.find({}, {"_id": 0}).to_list(200)


@api.post("/schedules")
async def create_schedule(payload: ScheduleIn, user: dict = Depends(get_current_user)):
    if not find_region(payload.region_id):
        raise HTTPException(status_code=400, detail="Invalid region_id")
    if payload.cadence not in ("daily", "weekly", "monthly"):
        raise HTTPException(status_code=400, detail="cadence must be daily|weekly|monthly")
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "user_id": user["id"],
        "region_id": payload.region_id,
        "cadence": payload.cadence,
        "filters": payload.filters,
        "limit": payload.limit,
        "active": payload.active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_run_at": None,
    }
    await db.schedules.insert_one(doc)
    if payload.active:
        _schedule_job(doc)
    return doc


@api.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, user: dict = Depends(get_current_user)):
    r = await db.schedules.delete_one({"id": schedule_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        scheduler.remove_job(schedule_id)
    except Exception:
        pass
    return {"ok": True}


@api.post("/schedules/{schedule_id}/run")
async def run_schedule_now(schedule_id: str, user: dict = Depends(get_current_user)):
    sch = await db.schedules.find_one({"id": schedule_id})
    if not sch:
        raise HTTPException(status_code=404, detail="Not found")
    job = await runner.create_job(
        user_id=user["id"],
        region_id=sch["region_id"],
        filters=sch["filters"],
        limit=sch["limit"],
        name=f"[Manual] {sch['name']}",
    )
    return job


# --- Dashboard stats ---
@api.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    total_jobs = await db.jobs.count_documents({})
    running = await db.jobs.count_documents({"status": "running"})
    completed = await db.jobs.count_documents({"status": "completed"})
    schedules = await db.schedules.count_documents({"active": True})
    # Total companies extracted (sum across completed jobs)
    agg = await db.jobs.aggregate([
        {"$match": {"status": "completed"}},
        {"$project": {"n": {"$size": {"$ifNull": ["$companies", []]}},
                       "nw": "$no_website_count"}},
        {"$group": {"_id": None, "total": {"$sum": "$n"}, "no_website": {"$sum": "$nw"}}},
    ]).to_list(1)
    totals = agg[0] if agg else {"total": 0, "no_website": 0}
    return {
        "total_jobs": total_jobs,
        "running_jobs": running,
        "completed_jobs": completed,
        "active_schedules": schedules,
        "total_companies": totals.get("total", 0),
        "no_website_companies": totals.get("no_website", 0),
    }


app.include_router(api)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
