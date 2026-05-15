from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


def now_iso():
    return datetime.now(timezone.utc).isoformat()


SAFE_STATUSES = ["available", "active", "submitted", "client_review", "revision", "completed"]


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
                "deadline": task.get("deadline"),
                "priority": task.get("priority", "medium"),
            })

        workload = []
        for editor in editors:
            active_count = await server.db.tasks.count_documents({"assigned_editor_id": editor["id"], "status": {"$in": ["active", "submitted", "revision"]}})
            workload.append({
                "team_member_name": editor.get("anime_name") or editor.get("real_name") or editor.get("email"),
                "role": "Editor",
                "active_tasks": active_count,
                "availability": "Overloaded" if active_count >= 5 else "Busy" if active_count >= 3 else "Available",
                "performance_status": "Needs support" if active_count >= 5 else "On track",
            })

        return {
            "overview": {
                "active_projects": sum(1 for t in safe_tasks if t.get("status") == "active"),
                "pending_approvals": sum(1 for t in safe_tasks if t.get("status") in ["submitted", "client_review"]),
                "urgent_deadlines": sum(1 for t in safe_tasks if t.get("priority") == "urgent"),
                "revision_requests": sum(1 for t in safe_tasks if t.get("status") == "revision"),
                "client_messages_waiting": len([m for m in messages if m.get("sender_role") == "client"]),
            },
            "managed_projects": managed_projects,
            "team_workload": workload,
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
        await server.notify_role("admin", "moderator_escalation", data.title, body=data.body, link="/admin")
        item.pop("_id", None)
        return item

    return router