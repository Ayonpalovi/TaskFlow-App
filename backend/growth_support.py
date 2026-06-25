from typing import Optional, Literal

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from growth_common import db, now_iso, new_id, require_growth_access

router = APIRouter(prefix="/api/growth/tickets")

TicketStatus = Literal["open", "in_progress", "resolved"]
TicketPriority = Literal["low", "normal", "high"]


class TicketIn(BaseModel):
    subject: str
    client_name: str
    lead_id: Optional[str] = None
    priority: TicketPriority = "normal"
    description: Optional[str] = None


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    status: Optional[TicketStatus] = None
    priority: Optional[TicketPriority] = None


class MessageIn(BaseModel):
    sender: Literal["you", "client"] = "you"
    content: str


@router.get("")
async def list_tickets(user: dict = Depends(require_growth_access)):
    return await db.growth_tickets.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.post("")
async def create_ticket(data: TicketIn, user: dict = Depends(require_growth_access)):
    doc = data.model_dump()
    doc.update({"id": new_id(), "status": "open", "created_at": now_iso(), "messages": []})
    if doc.get("description"):
        doc["messages"].append({"sender": "client", "content": doc["description"], "created_at": now_iso()})
    await db.growth_tickets.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str, user: dict = Depends(require_growth_access)):
    ticket = await db.growth_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.put("/{ticket_id}")
async def update_ticket(ticket_id: str, data: TicketUpdate, user: dict = Depends(require_growth_access)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if updates:
        await db.growth_tickets.update_one({"id": ticket_id}, {"$set": updates})
    updated = await db.growth_tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return updated


@router.post("/{ticket_id}/messages")
async def add_message(ticket_id: str, data: MessageIn, user: dict = Depends(require_growth_access)):
    ticket = await db.growth_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    message = {"sender": data.sender, "content": data.content, "created_at": now_iso()}
    update_fields = {"$push": {"messages": message}}
    if ticket.get("status") == "open" and data.sender == "you":
        update_fields["$set"] = {"status": "in_progress"}
    await db.growth_tickets.update_one({"id": ticket_id}, update_fields)
    return await db.growth_tickets.find_one({"id": ticket_id}, {"_id": 0})
