from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel, Field

from growth_common import db, now_iso, new_id, require_growth_access
from growth_csv_import import import_csv

router = APIRouter(prefix="/api/growth")

LeadStage = Literal["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]
STAGES: List[LeadStage] = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"]
Temperature = Literal["hot", "warm", "cold"]


# ---------- Leads / CRM ----------

class LeadIn(BaseModel):
    name: str
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    instagram: Optional[str] = None
    website: Optional[str] = None
    source: Optional[str] = "other"
    niche: Optional[str] = None
    value: Optional[float] = 0
    notes: Optional[str] = None
    campaign_id: Optional[str] = None
    tags: Optional[List[str]] = Field(default_factory=list)


class LeadUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    instagram: Optional[str] = None
    website: Optional[str] = None
    source: Optional[str] = None
    niche: Optional[str] = None
    value: Optional[float] = None
    notes: Optional[str] = None
    campaign_id: Optional[str] = None
    tags: Optional[List[str]] = None
    stage: Optional[LeadStage] = None
    temperature: Optional[Temperature] = None


async def log_activity(lead_id: str, type_: str, content: str):
    await db.growth_activities.insert_one({
        "id": new_id(),
        "lead_id": lead_id,
        "type": type_,
        "content": content,
        "created_at": now_iso(),
    })
    await db.growth_leads.update_one({"id": lead_id}, {"$set": {"last_activity_at": now_iso()}})


@router.get("/leads")
async def list_leads(stage: Optional[str] = None, search: Optional[str] = None, user: dict = Depends(require_growth_access)):
    query = {}
    if stage:
        query["stage"] = stage
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"company": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
        ]
    return await db.growth_leads.find(query, {"_id": 0}).sort("created_at", -1).to_list(2000)


@router.post("/leads")
async def create_lead(data: LeadIn, user: dict = Depends(require_growth_access)):
    doc = data.model_dump()
    doc.update({
        "id": new_id(),
        "stage": "new",
        "temperature": "cold",
        "created_at": now_iso(),
        "last_activity_at": now_iso(),
    })
    await db.growth_leads.insert_one(doc)
    await log_activity(doc["id"], "lead_created", f'Lead "{doc["name"]}" was created from source: {doc.get("source") or "other"}')
    doc.pop("_id", None)
    return doc


@router.post("/leads/import")
async def import_leads(file: UploadFile = File(...), user: dict = Depends(require_growth_access)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file.")
    content = await file.read()
    try:
        result = await import_csv(content, file.filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    result.pop("created_ids", None)
    return result


@router.get("/leads/{lead_id}")
async def get_lead(lead_id: str, user: dict = Depends(require_growth_access)):
    lead = await db.growth_leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.put("/leads/{lead_id}")
async def update_lead(lead_id: str, data: LeadUpdate, user: dict = Depends(require_growth_access)):
    lead = await db.growth_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "stage" in updates and updates["stage"] != lead.get("stage"):
        await log_activity(lead_id, "status_change", f"Stage changed: {lead.get('stage')} → {updates['stage']}")
    if "temperature" in updates and updates["temperature"] != lead.get("temperature"):
        await log_activity(lead_id, "note", f"Marked as {updates['temperature']}")
    if updates:
        await db.growth_leads.update_one({"id": lead_id}, {"$set": updates})
    return await db.growth_leads.find_one({"id": lead_id}, {"_id": 0})


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, user: dict = Depends(require_growth_access)):
    await db.growth_leads.delete_one({"id": lead_id})
    await db.growth_activities.delete_many({"lead_id": lead_id})
    await db.growth_followups.delete_many({"lead_id": lead_id})
    return {"ok": True}


# ---------- Activities ----------

class ActivityIn(BaseModel):
    type: Literal["note", "call", "email_sent", "dm_sent", "proposal_sent", "meeting"] = "note"
    content: str


@router.get("/leads/{lead_id}/activities")
async def get_activities(lead_id: str, user: dict = Depends(require_growth_access)):
    return await db.growth_activities.find({"lead_id": lead_id}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/leads/{lead_id}/activities")
async def add_activity(lead_id: str, data: ActivityIn, user: dict = Depends(require_growth_access)):
    lead = await db.growth_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await log_activity(lead_id, data.type, data.content)
    items = await db.growth_activities.find({"lead_id": lead_id}, {"_id": 0}).sort("created_at", -1).to_list(1)
    return items[0]


# ---------- Follow-ups ----------

class FollowUpIn(BaseModel):
    due_date: str
    description: str


@router.get("/followups")
async def list_followups(status: Optional[str] = None, user: dict = Depends(require_growth_access)):
    query = {}
    if status == "open":
        query["done"] = False
    items = await db.growth_followups.find(query, {"_id": 0}).sort("due_date", 1).to_list(1000)
    leads_by_id = {l["id"]: l for l in await db.growth_leads.find({}, {"_id": 0, "id": 1, "name": 1, "company": 1}).to_list(2000)}
    for item in items:
        lead = leads_by_id.get(item["lead_id"])
        item["lead_name"] = lead["name"] if lead else "Unknown"
        item["lead_company"] = lead.get("company") if lead else None
    return items


@router.post("/leads/{lead_id}/followups")
async def create_followup(lead_id: str, data: FollowUpIn, user: dict = Depends(require_growth_access)):
    lead = await db.growth_leads.find_one({"id": lead_id})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    doc = {
        "id": new_id(),
        "lead_id": lead_id,
        "due_date": data.due_date,
        "description": data.description,
        "done": False,
        "created_at": now_iso(),
    }
    await db.growth_followups.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.patch("/followups/{followup_id}/done")
async def complete_followup(followup_id: str, user: dict = Depends(require_growth_access)):
    await db.growth_followups.update_one({"id": followup_id}, {"$set": {"done": True, "completed_at": now_iso()}})
    return {"ok": True}


# ---------- Dashboard ----------

@router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(require_growth_access)):
    leads = await db.growth_leads.find({}, {"_id": 0}).to_list(5000)
    by_stage = {s: 0 for s in STAGES}
    value_by_stage = {s: 0.0 for s in STAGES}
    by_source: dict = {}
    by_temperature = {"hot": 0, "warm": 0, "cold": 0}
    for lead in leads:
        stage = lead.get("stage", "new")
        by_stage[stage] = by_stage.get(stage, 0) + 1
        value_by_stage[stage] = value_by_stage.get(stage, 0) + (lead.get("value") or 0)
        source = lead.get("source") or "other"
        by_source[source] = by_source.get(source, 0) + 1
        temp = lead.get("temperature") or "cold"
        by_temperature[temp] = by_temperature.get(temp, 0) + 1

    closed = by_stage.get("won", 0) + by_stage.get("lost", 0)
    win_rate = round((by_stage.get("won", 0) / closed) * 100, 1) if closed else 0.0
    open_pipeline_value = sum(v for s, v in value_by_stage.items() if s not in ("won", "lost"))
    active_leads = len(leads) - by_stage.get("won", 0) - by_stage.get("lost", 0)
    contacted = sum(by_stage.get(s, 0) for s in ["contacted", "qualified", "proposal", "negotiation", "won"])
    replied = sum(by_stage.get(s, 0) for s in ["qualified", "proposal", "negotiation", "won"])
    meetings_booked = await db.growth_activities.count_documents({"type": "meeting"})

    today_date = datetime.now(timezone.utc).date()
    today = today_date.isoformat()
    followups = await db.growth_followups.find({"done": False}, {"_id": 0}).to_list(1000)
    due_today = len([f for f in followups if f["due_date"][:10] == today])
    overdue = len([f for f in followups if f["due_date"][:10] < today])

    lead_growth_7d = []
    for i in range(6, -1, -1):
        day = today_date - timedelta(days=i)
        count = len([l for l in leads if l.get("created_at", "")[:10] == day.isoformat()])
        lead_growth_7d.append({"date": day.strftime("%a"), "leads": count})

    recent_activities = await db.growth_activities.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    recent_leads = sorted(leads, key=lambda l: l.get("created_at", ""), reverse=True)[:8]
    recent_leads = [
        {
            "id": l["id"],
            "name": l["name"],
            "company": l.get("company"),
            "niche": l.get("niche"),
            "stage": l.get("stage"),
            "temperature": l.get("temperature") or "cold",
        }
        for l in recent_leads
    ]

    return {
        "total_leads": len(leads),
        "active_leads": active_leads,
        "hot_leads": by_temperature.get("hot", 0),
        "contacted": contacted,
        "replied": replied,
        "meetings_booked": meetings_booked,
        "won_deals": by_stage.get("won", 0),
        "conversion_rate": win_rate,
        "by_stage": by_stage,
        "value_by_stage": value_by_stage,
        "by_source": by_source,
        "by_temperature": by_temperature,
        "win_rate": win_rate,
        "open_pipeline_value": open_pipeline_value,
        "followups_due_today": due_today,
        "followups_overdue": overdue,
        "lead_growth_7d": lead_growth_7d,
        "recent_activities": recent_activities,
        "recent_leads": recent_leads,
    }
