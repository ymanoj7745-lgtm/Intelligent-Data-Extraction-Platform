"""Excel export: multi-sheet .xlsx (All / No-Website / By-Region)."""

import io
import pandas as pd
from typing import Iterable


COLUMNS = [
    "company_number", "company_name", "company_status", "company_type",
    "incorporation_date", "sic_codes", "registered_address",
    "region", "has_website", "website", "email", "phone",
    "officers_summary",
]


def _flatten(companies: Iterable[dict]) -> list[dict]:
    rows = []
    for c in companies:
        addr = c.get("registered_address") or {}
        if isinstance(addr, dict):
            addr_str = ", ".join(
                str(addr[k]) for k in
                ("premises", "address_line_1", "address_line_2", "locality", "region", "postal_code", "country")
                if addr.get(k)
            )
        else:
            addr_str = str(addr)
        sic = c.get("sic_codes") or []
        if isinstance(sic, list):
            sic = ", ".join(sic)
        officers = c.get("officers") or []
        if isinstance(officers, list):
            officers_str = "; ".join(o.get("name", "") for o in officers[:5])
        else:
            officers_str = str(officers)
        rows.append({
            "company_number": c.get("company_number", ""),
            "company_name": c.get("company_name", ""),
            "company_status": c.get("company_status", ""),
            "company_type": c.get("company_type", ""),
            "incorporation_date": c.get("date_of_creation", ""),
            "sic_codes": sic,
            "registered_address": addr_str,
            "region": c.get("region", ""),
            "has_website": "Yes" if c.get("has_website") else "No",
            "website": c.get("website", "") or "",
            "email": c.get("email", "") or "",
            "phone": c.get("phone", "") or "",
            "officers_summary": officers_str,
        })
    return rows


def build_xlsx(companies: list[dict], job_meta: dict) -> bytes:
    rows = _flatten(companies)
    df_all = pd.DataFrame(rows, columns=COLUMNS)
    df_no_web = df_all[df_all["has_website"] == "No"]

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        # Summary sheet
        summary = pd.DataFrame({
            "field": ["job_id", "region", "filters", "total_companies", "no_website_count", "generated_at"],
            "value": [
                job_meta.get("id", ""),
                job_meta.get("region_name", ""),
                str(job_meta.get("filters", {})),
                len(df_all),
                len(df_no_web),
                job_meta.get("completed_at", ""),
            ],
        })
        summary.to_excel(writer, sheet_name="Summary", index=False)
        df_all.to_excel(writer, sheet_name="All Companies", index=False)
        df_no_web.to_excel(writer, sheet_name="No Website", index=False)

        # By-region sheets (if region column populated with >1 distinct)
        if not df_all.empty and df_all["region"].nunique() > 1:
            for region, sub in df_all.groupby("region"):
                sheet = f"Region - {region}"[:31]
                sub.to_excel(writer, sheet_name=sheet, index=False)

    buf.seek(0)
    return buf.getvalue()
