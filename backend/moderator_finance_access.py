from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException


def now_utc():
    return datetime.now(timezone.utc)


def now_iso():
    return now_utc().isoformat()


def parse_time(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def to_float(value):
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def task_revenue(task):
    return to_float(task.get("revenue") or task.get("price") or task.get("amount") or task.get("budget"))


def task_cost(task):
    return to_float(task.get("cost") or task.get("expense") or task.get("editor_cost"))


def task_date(task):
    return parse_time(task.get("created_at") or task.get("updated_at") or task.get("deadline")) or now_utc()


def state_key(moderator_id):
    return f"moderator_finance_access:{moderator_id}"


async def get_access_doc(server, moderator_id):
    doc = await server.db.system_state.find_one({"key": state_key(moderator_id)}, {"_id": 0})
    if not doc:
        return {"allowed": False, "expires_at": None}
    expires_at = parse_time(doc.get("expires_at"))
    allowed = bool(doc.get("allowed")) and expires_at and expires_at > now_utc()
    return {"allowed": allowed, "expires_at": doc.get("expires_at") if allowed else None}


def build_finance_payload(tasks):
    start = now_utc() - timedelta(days=30)
    recent = [task for task in tasks if task_date(task) >= start]
    revenue = sum(task_revenue(task) for task in recent)
    cost = sum(task_cost(task) for task in recent)
    days = []
    for offset in range(29, -1, -1):
        day = (now_utc() - timedelta(days=offset)).date()
        day_tasks = [task for task in recent if task_date(task).date() == day]
        day_revenue = sum(task_revenue(task) for task in day_tasks)
        day_cost = sum(task_cost(task) for task in day_tasks)
        days.append({
            "date": day.isoformat(),
            "revenue": round(day_revenue, 2),
            "profit": round(day_revenue - day_cost, 2),
            "tasks": len(day_tasks),
        })
    return {"monthly_revenue": round(revenue, 2), "monthly_profit": round(revenue - cost, 2), "daily": days}


def build_moderator_finance_router(server):
    router = APIRouter(prefix="/api")

    @router.get("/moderator/finance-access")
    async def finance_access(user: dict = Depends(server.get_current_user)):
        if user.get("role") not in ["moderator", "admin"]:
            raise HTTPException(403, "Moderator access only")
        access = {"allowed": True, "expires_at": None} if user.get("role") == "admin" else await get_access_doc(server, user["id"])
        if not access.get("allowed"):
            return {"finance_access": access, "monthly_revenue": None, "monthly_profit": None, "daily": []}
        tasks = await server.db.tasks.find({}, {"_id": 0}).to_list(1000)
        payload = build_finance_payload(tasks)
        return {"finance_access": access, **payload}

    @router.post("/moderator/finance-access/request")
    async def request_finance_access(user: dict = Depends(server.get_current_user)):
        if user.get("role") != "moderator":
            raise HTTPException(403, "Moderator access only")
        request_doc = {
            "id": str(server.uuid.uuid4()),
            "actor_id": user["id"],
            "action": "moderator_finance_access_requested",
            "target_user_id": user["id"],
            "target_email": user.get("email"),
            "metadata": {"duration_hours": 6, "status": "pending"},
            "created_at": now_iso(),
        }
        await server.db.activity_logs.insert_one(request_doc.copy())
        await server.notify_role(
            "admin",
            "moderator_finance_access_requested",
            "Moderator requested finance access",
            body=f"{user.get('real_name') or user.get('email')} requested revenue/profit visibility for 6 hours.",
            link="/admin/users",
        )
        request_doc.pop("_id", None)
        return {"ok": True, "request": request_doc}

    @router.post("/admin/moderator-finance-access/grant/{moderator_id}")
    async def grant_finance_access(moderator_id: str, admin: dict = Depends(server.require_role("admin"))):
        moderator = await server.db.users.find_one({"id": moderator_id, "role": "moderator"}, {"_id": 0, "password_hash": 0})
        if not moderator:
            raise HTTPException(404, "Moderator not found")
        expires_at = now_utc() + timedelta(hours=6)
        doc = {
            "key": state_key(moderator_id),
            "allowed": True,
            "moderator_id": moderator_id,
            "granted_by_admin_id": admin["id"],
            "granted_at": now_iso(),
            "expires_at": expires_at.isoformat(),
            "duration_hours": 6,
        }
        await server.db.system_state.update_one({"key": state_key(moderator_id)}, {"$set": doc}, upsert=True)
        await server.create_notification(moderator_id, "finance_access_granted", "Finance access approved", body="Revenue and profit are visible for 6 hours.", link="/moderator/overview")
        return {"ok": True, "finance_access": {"allowed": True, "expires_at": expires_at.isoformat()}}

    @router.post("/admin/moderator-finance-access/revoke/{moderator_id}")
    async def revoke_finance_access(moderator_id: str, admin: dict = Depends(server.require_role("admin"))):
        await server.db.system_state.update_one({"key": state_key(moderator_id)}, {"$set": {"allowed": False, "revoked_by_admin_id": admin["id"], "revoked_at": now_iso()}}, upsert=True)
        await server.create_notification(moderator_id, "finance_access_revoked", "Finance access revoked", body="Revenue and profit are hidden again.", link="/moderator/overview")
        return {"ok": True}

    return router
