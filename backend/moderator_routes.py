from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


def now_dt():
    return datetime.now(timezone.utc)


def now_iso():
    return now_dt().isoformat()


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


SAFE_STATUSES = ["available", "active", "submitted", "client_review", "revision", "completed"]
STATUS_LABELS = {
    "available": "available",
    "active": "active",
    "submitted": "awaiting_admin_approval",
    "pending": "awaiting_admin_approval",
    "admin_review": "awaiting_admin_approval",
    "client_review": "client_review",
    "revision": "revision",
    "completed": "completed",
}
STATUS_ORDER = ["available", "active", "awaiting_admin_approval", "client_review", "revision", "completed"]


class ModeratorTaskUpdateIn(BaseModel):
    status: Optional[str] = None
    deadline: Optional[str] = None
    assigned_editor_id: Optional[str] = None
    priority: Optional[str] = None
    internal_note: Optional[str] = None


class ModeratorMessageIn(BaseModel):
    client_id: str
    content: str


class ModeratorEscalationIn(BaseModel):
    title: str
    body: str = ""
    project_id: Optional[str] = None
    category: str = "general"


def normalized_status(task):
    return STATUS_LABELS.get(str(task.get("status") or "available"), str(task.get("status") or "available"))


def task_date(task):
    return parse_time(task.get("created_at") or task.get("updated_at") or task.get("deadline")) or now_dt()


def task_revenue(task):
    return to_float(task.get("revenue") or task.get("price") or task.get("amount") or task.get("budget"))


def task_cost(task):
    return to_float(task.get("cost") or task.get("expense") or task.get("editor_cost"))


def finance_state_key(moderator_id):
    return f"moderator_finance_access:{moderator_id}"


def clean_task(task):
    item = dict(task)
    item.pop("_id", None)
    item.pop("revenue", None)
    item.pop("profit", None)
    item.pop("cost", None)
    item.pop("payment", None)
    return item


def safe_user(user):
    if not user:
        return {}
    item = dict(user)
    item.pop("_id", None)
    item.pop("password_hash", None)
    item.pop("invite_hash", None)
    return item


def clean_log(item):
    doc = dict(item or {})
    doc.pop("_id", None)
    return doc


def build_status_breakdown(tasks):
    counts = {key: 0 for key in STATUS_ORDER}
    for task in tasks:
        key = normalized_status(task)
        counts[key] = counts.get(key, 0) + 1
    return [{"name": key, "value": counts.get(key, 0)} for key in STATUS_ORDER]


def build_operations_trend(tasks):
    today = now_dt().date()
    rows = []
    for offset in range(29, -1, -1):
        day = today - timedelta(days=offset)
        day_tasks = [task for task in tasks if task_date(task).date() == day]
        rows.append({
            "date": day.isoformat(),
            "tasks": len(day_tasks),
            "active": sum(1 for task in day_tasks if normalized_status(task) == "active"),
            "reviews": sum(1 for task in day_tasks if normalized_status(task) in ["awaiting_admin_approval", "client_review"]),
            "revisions": sum(1 for task in day_tasks if normalized_status(task) == "revision"),
            "completed": sum(1 for task in day_tasks if normalized_status(task) == "completed"),
        })
    return rows


def build_finance_payload(tasks):
    start = now_dt() - timedelta(days=30)
    recent = [task for task in tasks if task_date(task) >= start]
    revenue = sum(task_revenue(task) for task in recent)
    cost = sum(task_cost(task) for task in recent)
    rows = []
    for offset in range(29, -1, -1):
        day = (now_dt() - timedelta(days=offset)).date()
        day_tasks = [task for task in recent if task_date(task).date() == day]
        day_revenue = sum(task_revenue(task) for task in day_tasks)
        day_cost = sum(task_cost(task) for task in day_tasks)
        rows.append({
            "date": day.isoformat(),
            "revenue": round(day_revenue, 2),
            "profit": round(day_revenue - day_cost, 2),
            "tasks": len(day_tasks),
        })
    return {"monthly_revenue": round(revenue, 2), "monthly_profit": round(revenue - cost, 2), "daily": rows}


async def get_finance_access_doc(server, moderator_id):
    doc = await server.db.system_state.find_one({"key": finance_state_key(moderator_id)}, {"_id": 0})
    if not doc:
        return {"allowed": False, "expires_at": None}
    expires_at = parse_time(doc.get("expires_at"))
    allowed = bool(doc.get("allowed")) and expires_at and expires_at > now_dt()
    return {"allowed": allowed, "expires_at": doc.get("expires_at") if allowed else None}


async def safe_notify_role(server, role, notification_type, title, body="", link=""):
    try:
        if hasattr(server, "notify_role"):
            await server.notify_role(role, notification_type, title, body=body, link=link)
            return True
    except Exception as exc:
        print(f"Moderator notification failed: {exc}")
    return False


async def safe_create_notification(server, user_id, notification_type, title, body="", link=""):
    try:
        if hasattr(server, "create_notification"):
            await server.create_notification(user_id, notification_type, title, body=body, link=link)
            return True
    except Exception as exc:
        print(f"Moderator notification failed: {exc}")
    return False


def build_moderator_router(server):
    router = APIRouter(prefix="/api")

    def require_moderator_or_admin(user):
        if user.get("role") not in ["moderator", "admin"]:
            raise HTTPException(403, "Moderator access only")
        return user

    @router.get("/moderator/profile")
    async def moderator_profile(user: dict = Depends(server.get_current_user)):
        require_moderator_or_admin(user)
        moderator = await server.db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
        if not moderator:
            raise HTTPException(404, "Moderator not found")
        assigned_projects = await server.db.tasks.count_documents({"moderator_id": user["id"]})
        tasks_managed = await server.db.activity_logs.count_documents({"actor_id": user["id"]})
        client_messages = await server.db.messages.count_documents({"sender_id": user["id"], "sender_role": "moderator"})
        supervised = await server.db.tasks.distinct("assigned_editor_id", {"moderator_id": user["id"], "assigned_editor_id": {"$ne": None}})
        recent_activity = await server.db.activity_logs.find({"actor_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
        return {
            "avatar_url": moderator.get("avatar_url"),
            "real_name": moderator.get("real_name"),
            "email": moderator.get("email"),
            "role": "Moderator",
            "status": moderator.get("status", "active"),
            "online": moderator.get("online", False),
            "assigned_departments": moderator.get("assigned_departments") or moderator.get("skills") or [],
            "permission_level": moderator.get("permission_level", "Limited operations access"),
            "assigned_projects": assigned_projects,
            "tasks_managed": tasks_managed,
            "client_conversations_handled": client_messages,
            "team_members_supervised": len([x for x in supervised if x]),
            "recent_activity_log": recent_activity,
            "escalation_notes_to_admin": moderator.get("escalation_notes", []),
            "date_invited": moderator.get("invited_at") or moderator.get("created_at"),
            "last_active_time": moderator.get("last_seen"),
        }

    @router.get("/moderator/dashboard")
    async def moderator_dashboard(user: dict = Depends(server.get_current_user)):
        require_moderator_or_admin(user)
        tasks = await server.db.tasks.find({"status": {"$ne": "draft"}}, {"_id": 0}).sort("created_at", -1).to_list(1000)
        safe_tasks = [clean_task(t) for t in tasks]
        editors = await server.db.users.find({"role": "editor", "status": {"$ne": "deactivated"}}, {"_id": 0, "password_hash": 0}).to_list(500)
        clients = await server.db.users.find({"role": "client", "status": {"$ne": "deactivated"}}, {"_id": 0, "password_hash": 0}).to_list(500)
        messages = await server.db.messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(30)
        escalations = await server.db.activity_logs.find({"actor_id": user["id"], "action": "moderator_escalation"}, {"_id": 0}).sort("created_at", -1).to_list(20)
        activity = await server.db.activity_logs.find({"actor_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

        client_map = {c["id"]: c for c in clients}
        editor_map = {e["id"]: e for e in editors}

        managed_projects = []
        for task in safe_tasks:
            client = client_map.get(task.get("client_id"), {})
            editor = editor_map.get(task.get("assigned_editor_id"), {})
            managed_projects.append({
                "id": task.get("id"),
                "project_name": task.get("title") or task.get("name"),
                "client_name": client.get("real_name") or client.get("email") or "—",
                "service_type": task.get("project_type") or task.get("service_type") or "Video Editing",
                "assigned_team_member": editor.get("anime_name") or editor.get("real_name") or "Unassigned",
                "assigned_editor_id": task.get("assigned_editor_id"),
                "current_status": task.get("status"),
                "status_group": normalized_status(task),
                "deadline": task.get("deadline"),
                "priority": task.get("priority", "medium"),
            })

        workload = []
        for editor in editors:
            active_count = await server.db.tasks.count_documents({"assigned_editor_id": editor["id"], "status": {"$in": ["active", "submitted", "client_review", "revision"]}})
            workload.append({
                "team_member_name": editor.get("anime_name") or editor.get("real_name") or editor.get("email"),
                "role": "Editor",
                "active_tasks": active_count,
                "availability": "Overloaded" if active_count >= 5 else "Busy" if active_count >= 3 else "Available",
                "performance_status": "Needs support" if active_count >= 5 else "On track",
            })

        status_breakdown = build_status_breakdown(safe_tasks)
        operations_daily = build_operations_trend(safe_tasks)

        return {
            "overview": {
                "total_projects": len(safe_tasks),
                "available_projects": sum(1 for t in safe_tasks if normalized_status(t) == "available"),
                "active_projects": sum(1 for t in safe_tasks if normalized_status(t) == "active"),
                "pending_approvals": sum(1 for t in safe_tasks if normalized_status(t) == "awaiting_admin_approval"),
                "client_review": sum(1 for t in safe_tasks if normalized_status(t) == "client_review"),
                "urgent_deadlines": sum(1 for t in safe_tasks if t.get("priority") == "urgent"),
                "revision_requests": sum(1 for t in safe_tasks if normalized_status(t) == "revision"),
                "completed": sum(1 for t in safe_tasks if normalized_status(t) == "completed"),
                "client_messages_waiting": len([m for m in messages if m.get("sender_role") == "client"]),
            },
            "managed_projects": managed_projects,
            "team_workload": workload,
            "status_breakdown": status_breakdown,
            "operations_daily": operations_daily,
            "editors": [safe_user(e) | {"name": e.get("anime_name") or e.get("real_name") or e.get("email")} for e in editors],
            "client_communication": {
                "recent_messages": messages[:10],
                "pending_replies": [m for m in messages if m.get("sender_role") == "client"][:10],
                "important_client_notes": [],
            },
            "escalation_center": {
                "issues_needing_admin_attention": escalations,
                "payment_related_problems": [e for e in escalations if e.get("metadata", {}).get("category") == "payment"],
                "conflict_or_delay_reports": [e for e in escalations if e.get("metadata", {}).get("category") in ["conflict", "delay"]],
            },
            "activity_log": activity,
        }

    @router.get("/moderator/finance-access")
    async def moderator_finance_access(user: dict = Depends(server.get_current_user)):
        require_moderator_or_admin(user)
        access = {"allowed": True, "expires_at": None} if user.get("role") == "admin" else await get_finance_access_doc(server, user["id"])
        if not access.get("allowed"):
            return {"finance_access": access, "monthly_revenue": None, "monthly_profit": None, "daily": []}
        tasks = await server.db.tasks.find({}, {"_id": 0}).to_list(1000)
        return {"finance_access": access, **build_finance_payload(tasks)}

    @router.post("/moderator/finance-access/request")
    async def request_moderator_finance_access(user: dict = Depends(server.get_current_user)):
        if user.get("role") != "moderator":
            raise HTTPException(403, "Moderator access only")
        existing = await server.db.activity_logs.find_one({
            "actor_id": user["id"],
            "action": "moderator_finance_access_requested",
            "metadata.status": "pending",
        }, {"_id": 0})
        if existing:
            return {"ok": True, "request": existing, "already_pending": True}
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
        notification_sent = await safe_notify_role(server, "admin", "moderator_finance_access_requested", "Moderator requested finance access", body=f"{user.get('real_name') or user.get('email')} requested revenue/profit visibility for 6 hours.", link="/admin/users")
        await server.db.activity_logs.update_one({"id": request_doc["id"]}, {"$set": {"metadata.notification_sent": notification_sent}})
        request_doc["metadata"]["notification_sent"] = notification_sent
        return {"ok": True, "request": clean_log(request_doc), "notification_sent": notification_sent}

    @router.get("/admin/moderator-finance-access/requests")
    async def list_moderator_finance_access_requests(admin: dict = Depends(server.require_role("admin"))):
        requests = await server.db.activity_logs.find({
            "action": "moderator_finance_access_requested",
            "metadata.status": "pending",
        }, {"_id": 0}).sort("created_at", -1).to_list(50)
        moderator_ids = [item.get("actor_id") for item in requests if item.get("actor_id")]
        moderators = await server.db.users.find({"id": {"$in": moderator_ids}}, {"_id": 0, "password_hash": 0}).to_list(100)
        moderator_map = {m.get("id"): m for m in moderators}
        return [{**clean_log(item), "moderator": moderator_map.get(item.get("actor_id"), {})} for item in requests]

    @router.post("/admin/moderator-finance-access/grant/{moderator_id}")
    async def grant_moderator_finance_access(moderator_id: str, admin: dict = Depends(server.require_role("admin"))):
        moderator = await server.db.users.find_one({"id": moderator_id, "role": "moderator"}, {"_id": 0, "password_hash": 0})
        if not moderator:
            raise HTTPException(404, "Moderator not found")
        expires_at = now_dt() + timedelta(hours=6)
        doc = {
            "key": finance_state_key(moderator_id),
            "allowed": True,
            "moderator_id": moderator_id,
            "granted_by_admin_id": admin["id"],
            "granted_at": now_iso(),
            "expires_at": expires_at.isoformat(),
            "duration_hours": 6,
        }
        await server.db.system_state.update_one({"key": finance_state_key(moderator_id)}, {"$set": doc}, upsert=True)
        await server.db.activity_logs.update_many({"actor_id": moderator_id, "action": "moderator_finance_access_requested", "metadata.status": "pending"}, {"$set": {"metadata.status": "approved", "metadata.approved_by_admin_id": admin["id"], "metadata.approved_at": now_iso(), "metadata.expires_at": expires_at.isoformat()}})
        await safe_create_notification(server, moderator_id, "finance_access_granted", "Finance access approved", body="Revenue and profit are visible for 6 hours.", link="/moderator/overview")
        return {"ok": True, "finance_access": {"allowed": True, "expires_at": expires_at.isoformat()}}

    @router.post("/admin/moderator-finance-access/revoke/{moderator_id}")
    async def revoke_moderator_finance_access(moderator_id: str, admin: dict = Depends(server.require_role("admin"))):
        await server.db.system_state.update_one({"key": finance_state_key(moderator_id)}, {"$set": {"allowed": False, "revoked_by_admin_id": admin["id"], "revoked_at": now_iso()}}, upsert=True)
        await safe_create_notification(server, moderator_id, "finance_access_revoked", "Finance access revoked", body="Revenue and profit are hidden again.", link="/moderator/overview")
        return {"ok": True}

    @router.patch("/moderator/projects/{task_id}")
    async def update_moderated_project(task_id: str, data: ModeratorTaskUpdateIn, user: dict = Depends(server.get_current_user)):
        require_moderator_or_admin(user)
        task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not task:
            raise HTTPException(404, "Project not found")
        updates = {"moderator_id": user["id"], "updated_at": now_iso()}
        if data.status is not None:
            if data.status not in SAFE_STATUSES:
                raise HTTPException(400, "Moderator cannot set this status")
            updates["status"] = data.status
        if data.deadline is not None:
            updates["deadline"] = data.deadline
        if data.priority is not None:
            updates["priority"] = data.priority
        if data.assigned_editor_id is not None:
            editor = await server.db.users.find_one({"id": data.assigned_editor_id, "role": "editor", "status": {"$ne": "deactivated"}})
            if not editor:
                raise HTTPException(400, "Select a valid active editor")
            updates["assigned_editor_id"] = data.assigned_editor_id
            if not updates.get("status"):
                updates["status"] = "active"
        if data.internal_note:
            note = {"id": str(server.uuid.uuid4()), "note": data.internal_note, "created_by": user["id"], "created_by_role": "moderator", "created_at": now_iso()}
            await server.db.tasks.update_one({"id": task_id}, {"$push": {"internal_notes": note}})
        await server.db.tasks.update_one({"id": task_id}, {"$set": updates})
        await server.db.activity_logs.insert_one({"id": str(server.uuid.uuid4()), "actor_id": user["id"], "action": "moderator_project_update", "target_user_id": task.get("client_id"), "target_email": task.get("title"), "metadata": {"task_id": task_id, "updates": list(updates.keys())}, "created_at": now_iso()})
        updated = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        return clean_task(updated)

    @router.post("/moderator/messages")
    async def send_moderator_message(data: ModeratorMessageIn, user: dict = Depends(server.get_current_user)):
        require_moderator_or_admin(user)
        client = await server.db.users.find_one({"id": data.client_id, "role": "client"})
        if not client:
            raise HTTPException(404, "Client not found")
        msg = {"id": str(server.uuid.uuid4()), "channel": f"dm:{data.client_id}", "sender_id": user["id"], "sender_name": user.get("real_name") or "Moderator", "sender_role": "moderator", "content": data.content, "created_at": now_iso()}
        await server.db.messages.insert_one(msg.copy())
        msg.pop("_id", None)
        return msg

    @router.post("/moderator/escalations")
    async def create_escalation(data: ModeratorEscalationIn, user: dict = Depends(server.get_current_user)):
        require_moderator_or_admin(user)
        item = {"id": str(server.uuid.uuid4()), "actor_id": user["id"], "action": "moderator_escalation", "target_user_id": None, "target_email": data.title, "metadata": {"project_id": data.project_id, "category": data.category, "body": data.body}, "created_at": now_iso()}
        await server.db.activity_logs.insert_one(item.copy())
        await safe_notify_role(server, "admin", "moderator_escalation", data.title, body=data.body, link="/admin")
        item.pop("_id", None)
        return item

    return router