from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException


def now():
    return datetime.now(timezone.utc).isoformat()


def money(v):
    try:
        return float(v or 0)
    except Exception:
        return 0


async def totals(server):
    tasks = await server.db.tasks.find({}, {"_id": 0}).to_list(5000)
    month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
    rows = [t for t in tasks if (t.get("created_at") or "") >= month]
    revenue = sum(money(t.get("revenue") or t.get("price") or t.get("amount") or t.get("budget")) for t in rows)
    cost = sum(money(t.get("cost") or t.get("expense") or t.get("editor_cost")) for t in rows)
    return {"monthly_revenue": revenue, "monthly_profit": revenue - cost, "daily": []}


def build_router(server):
    r = APIRouter(prefix="/api/workflow")

    @r.get("/moderator-finance/access")
    async def access(user: dict = Depends(server.get_current_user)):
        if user["role"] == "admin":
            return {"finance_access": {"allowed": True, "expires_at": None}, **await totals(server)}
        if user["role"] != "moderator":
            raise HTTPException(403, "Moderator only")
        req = await server.db.moderator_finance_requests.find_one({"moderator_id": user["id"], "status": "approved", "expires_at": {"$gt": now()}}, {"_id": 0})
        if not req:
            return {"finance_access": {"allowed": False, "expires_at": None}, "monthly_revenue": None, "monthly_profit": None, "daily": []}
        return {"finance_access": {"allowed": True, "expires_at": req.get("expires_at")}, **await totals(server)}

    @r.post("/moderator-finance/request")
    async def ask(user: dict = Depends(server.get_current_user)):
        if user["role"] != "moderator":
            raise HTTPException(403, "Moderator only")
        old = await server.db.moderator_finance_requests.find_one({"moderator_id": user["id"], "status": "pending"}, {"_id": 0})
        if old:
            return {"ok": True, "already_pending": True, "request": old}
        doc = {"id": str(server.uuid.uuid4()), "moderator_id": user["id"], "moderator_name": user.get("real_name") or user.get("email") or "Moderator", "moderator_email": user.get("email"), "status": "pending", "created_at": now(), "updated_at": now()}
        await server.db.moderator_finance_requests.insert_one(doc.copy())
        try:
            await server.notify_role("admin", "moderator_finance_request", "Moderator requested finance access", body="Approve or reject it from Team page.", link="/admin/users")
        except Exception:
            pass
        doc.pop("_id", None)
        return {"ok": True, "request": doc}

    @r.get("/moderator-finance/requests")
    async def pending(user: dict = Depends(server.get_current_user)):
        if user["role"] != "admin":
            raise HTTPException(403, "Admin only")
        return await server.db.moderator_finance_requests.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(100)

    @r.post("/moderator-finance/requests/{request_id}/approve")
    async def approve(request_id: str, user: dict = Depends(server.get_current_user)):
        if user["role"] != "admin":
            raise HTTPException(403, "Admin only")
        exp = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()
        await server.db.moderator_finance_requests.update_one({"id": request_id}, {"$set": {"status": "approved", "expires_at": exp, "approved_at": now(), "approved_by_admin_id": user["id"]}})
        return {"ok": True, "expires_at": exp}

    @r.post("/moderator-finance/requests/{request_id}/reject")
    async def reject(request_id: str, user: dict = Depends(server.get_current_user)):
        if user["role"] != "admin":
            raise HTTPException(403, "Admin only")
        await server.db.moderator_finance_requests.update_one({"id": request_id}, {"$set": {"status": "rejected", "rejected_at": now(), "rejected_by_admin_id": user["id"]}})
        return {"ok": True}

    return r
