from typing import Optional, Literal

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from growth_common import db, now_iso, new_id, require_growth_access

router = APIRouter(prefix="/api/growth/campaigns")

CampaignStatus = Literal["planning", "active", "paused", "done"]


class CampaignIn(BaseModel):
    name: str
    channel: str
    status: CampaignStatus = "planning"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    channel: Optional[str] = None
    status: Optional[CampaignStatus] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    notes: Optional[str] = None


@router.get("")
async def list_campaigns(user: dict = Depends(require_growth_access)):
    campaigns = await db.growth_campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    lead_counts: dict = {}
    for lead in await db.growth_leads.find({"campaign_id": {"$ne": None}}, {"_id": 0, "campaign_id": 1, "stage": 1}).to_list(5000):
        cid = lead.get("campaign_id")
        if not cid:
            continue
        lead_counts.setdefault(cid, {"total": 0, "won": 0})
        lead_counts[cid]["total"] += 1
        if lead.get("stage") == "won":
            lead_counts[cid]["won"] += 1
    for c in campaigns:
        counts = lead_counts.get(c["id"], {"total": 0, "won": 0})
        c["leads_attributed"] = counts["total"]
        c["leads_won"] = counts["won"]
    return campaigns


@router.post("")
async def create_campaign(data: CampaignIn, user: dict = Depends(require_growth_access)):
    doc = data.model_dump()
    doc.update({"id": new_id(), "created_at": now_iso()})
    await db.growth_campaigns.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/{campaign_id}")
async def update_campaign(campaign_id: str, data: CampaignUpdate, user: dict = Depends(require_growth_access)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        await db.growth_campaigns.update_one({"id": campaign_id}, {"$set": updates})
    updated = await db.growth_campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return updated


@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str, user: dict = Depends(require_growth_access)):
    await db.growth_campaigns.delete_one({"id": campaign_id})
    await db.growth_leads.update_many({"campaign_id": campaign_id}, {"$set": {"campaign_id": None}})
    return {"ok": True}
