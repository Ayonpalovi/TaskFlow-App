from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


def now_iso():
    return datetime.now(timezone.utc).isoformat()


DEFAULT_MODERATOR_PERMISSIONS = [
    "view_projects",
    "assign_projects",
    "update_status",
    "review_files",
    "reply_clients",
    "approve_revisions",
    "manage_deadlines",
    "send_back",
    "notify_admin",
    "view_workload",
    "view_client_progress",
]

SAFE_STATUSES = ["available", "active", "submitted", "client_review", "revision", "completed"]


class AbsenceModeIn(BaseModel):
    moderator_id: str
    duration_hours: int = 24
    allowed_permissions: List[str] = DEFAULT_MODERATOR_PERMISSIONS
    restricted_permissions: List[str] = []
    note: Optional[str] = ""


class ModeratorTaskPatchIn(BaseModel):
    status: Optional[str] = None
    deadline: Optional[str] = None
    assigned_editor_id: Optional[str] = None
    priority: Optional[str] = None


class ModeratorSendBackIn(BaseModel):
    note: str = ""


class ModeratorNotifyAdminIn(BaseModel):
    title: str
    body: str = ""


class ModeratorMessageIn(BaseModel):
    client_id: str
    content: str


def parse_time(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def mode_is_active(mode):
    if not mode or not mode.get("active"):
        return False
    ends_at = parse_time(mode.get("ends_at"))
    return not ends_at or ends_at >= datetime.now(timezone.utc)


def clean_permissions(values):
    allowed = set(DEFAULT_MODERATOR_PERMISSIONS)
    return [item for item in (values or []) if item in allowed]


def hide_money(task):
    clean = dict(task)
    clean.pop("_id", None)
    clean.pop("revenue", None)
    clean.pop("cost", None)
    return clean


async def get_mode(server):
    mode = await server.db.system_state.find_one({"key": "absence_mode"}, {"_id": 0})
    if not mode:
        return {"key": "absence_mode", "active": False, "allowed_permissions": DEFAULT_MODERATOR_PERMISSIONS, "restricted_permissions": []}
    if mode.get("active") and not mode_is_active(mode):
        await server.db.system_state.update_one({"key": "absence_mode"}, {"$set": {"active": False, "auto_disabled_at": now_iso()}}, upsert=True)
        mode["active"] = False
    return mode


async def require_moderator_permission(server, user, permission):
    if user.get("role") == "admin":
        return await get_mode(server)
    if user.get("role") != "moderator":
        raise HTTPException(403, "Moderator access only")
    mode = await get_mode(server)
    if not mode_is_active(mode):
        raise HTTPException(403, "Absence Mode is not active")
    if mode.get("moderator_id") != user.get("id"):
        raise HTTPException(403, "You are not the selected Moderator")
    allowed = set(mode.get("allowed_permissions") or DEFAULT_MODERATOR_PERMISSIONS)
    restricted = set(mode.get("restricted_permissions") or [])
    if permission not in allowed or permission in restricted:
        raise HTTPException(403, f"Moderator permission blocked: {permission}")
    return mode


def build_moderator_router(server):
    router = APIRouter(prefix="/api")

    @router.get("/absence-mode")
    async def absence_mode(user: dict = Depends(server.get_current_user)):
        mode = await get_mode(server)
        if mode.get("moderator_id") and user.get("role") == "admin":
            moderator = await server.db.users.find_one({"id": mode["moderator_id"]}, {"_id": 0, "password_hash": 0})
            if moderator:
                mode["moderator"] = server.scrub_user(moderator, viewer_role="admin")
        return mode

    @router.put("/absence-mode")
    async def enable_absence_mode(data: AbsenceModeIn, admin: dict = Depends(server.require_role("admin"))):
        moderator = await server.db.users.find_one({"id": data.moderator_id, "role": "moderator"}, {"_id": 0, "password_hash": 0})
        if not moderator:
            raise HTTPException(400, "Select a valid Moderator account")
        if moderator.get("status") == "deactivated":
            raise HTTPException(400, "Selected Moderator is deactivated")
        duration = max(1, min(int(data.duration_hours or 24), 720))
        start = datetime.now(timezone.utc)
        doc = {
            "key": "absence_mode",
            "active": True,
            "moderator_id": moderator["id"],
            "moderator_name": moderator.get("real_name") or moderator.get("email"),
            "allowed_permissions": clean_permissions(data.allowed_permissions or DEFAULT_MODERATOR_PERMISSIONS),
            "restricted_permissions": clean_permissions(data.restricted_permissions or []),
            "note": data.note or "",
            "starts_at": start.isoformat(),
            "ends_at": (start + timedelta(hours=duration)).isoformat(),
            "enabled_by_admin_id": admin["id"],
            "updated_at": now_iso(),
        }
        await server.db.system_state.update_one({"key": "absence_mode"}, {"$set": doc}, upsert=True)
        await server.create_notification(moderator["id"], "absence_mode_enabled", "Absence Mode is active", body="You are now managing operations temporarily.", link="/moderator")
        await server.notify_role("admin", "absence_mode_enabled", "Absence Mode enabled", body=f"Moderator: {doc['moderator_name']}")
        return doc

    @router.delete("/absence-mode")
    async def disable_absence_mode(admin: dict = Depends(server.require_role("admin"))):
        mode = await get_mode(server)
        await server.db.system_state.update_one({"key": "absence_mode"}, {"$set": {"active": False, "disabled_at": now_iso(), "disabled_by_admin_id": admin["id"]}}, upsert=True)
        if mode.get("moderator_id"):
            await server.create_notification(mode["moderator_id"], "absence_mode_disabled", "Absence Mode turned off", body="Owner/Admin has resumed operations.")
        return {"ok": True}

    @router.get("/moderator/dashboard")
    async def moderator_dashboard(user: dict = Depends(server.get_current_user)):
        await require_moderator_permission(server, user, "view_projects")
        tasks = await server.db.tasks.find({"status": {"$ne": "draft"}}, {"_id": 0}).sort("created_at", -1).to_list(1000)
        editors = await server.db.users.find({"role": "editor", "status": {"$ne": "deactivated"}}, {"_id": 0, "password_hash": 0}).to_list(500)
        clients = await server.db.users.find({"role": "client", "status": {"$ne": "deactivated"}}, {"_id": 0, "password_hash": 0}).to_list(500)
        safe_tasks = [hide_money(t) for t in tasks]

        workload = []
        for editor in editors:
            active = await server.db.tasks.count_documents({"assigned_editor_id": editor["id"], "status": {"$in": ["active", "submitted", "revision"]}})
            workload.append({"editor": server.scrub_user(editor, viewer_role="moderator"), "total": active, "load_pct": min(100, active * 20), "status": "overloaded" if active >= 5 else "busy" if active >= 3 else "available"})

        client_progress = []
        for client in clients:
            client_tasks = [t for t in safe_tasks if t.get("client_id") == client["id"]]
            if client_tasks:
                client_progress.append({"client": server.scrub_user(client, viewer_role="moderator"), "total": len(client_tasks), "completed": sum(1 for t in client_tasks if t.get("status") == "completed"), "revision": sum(1 for t in client_tasks if t.get("status") == "revision"), "in_progress": sum(1 for t in client_tasks if t.get("status") in ["active", "submitted", "client_review"])})

        requests = await server.db.requests.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(200)
        return {"absence_mode": await get_mode(server), "tasks": safe_tasks, "workload": workload, "client_progress": client_progress, "pending_requests": requests, "editors": [server.scrub_user(e, viewer_role="moderator") for e in editors]}

    @router.patch("/moderator/tasks/{task_id}")
    async def moderator_update_task(task_id: str, data: ModeratorTaskPatchIn, user: dict = Depends(server.get_current_user)):
        task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not task:
            raise HTTPException(404, "Task not found")
        updates = {}
        if data.status is not None:
            await require_moderator_permission(server, user, "update_status")
            if data.status not in SAFE_STATUSES:
                raise HTTPException(400, "Moderators cannot move projects to this status")
            updates["status"] = data.status
        if data.deadline is not None:
            await require_moderator_permission(server, user, "manage_deadlines")
            updates["deadline"] = data.deadline
        if data.priority is not None:
            await require_moderator_permission(server, user, "manage_deadlines")
            updates["priority"] = data.priority
        if data.assigned_editor_id is not None:
            await require_moderator_permission(server, user, "assign_projects")
            if data.assigned_editor_id:
                editor = await server.db.users.find_one({"id": data.assigned_editor_id, "role": "editor", "status": {"$ne": "deactivated"}})
                if not editor:
                    raise HTTPException(400, "Select a valid active editor")
            updates["assigned_editor_id"] = data.assigned_editor_id or None
            if data.assigned_editor_id and not updates.get("status"):
                updates["status"] = "active"
        if not updates:
            raise HTTPException(400, "No allowed changes provided")
        updates["updated_at"] = now_iso()
        updates["last_moderated_by"] = user.get("id")
        await server.db.tasks.update_one({"id": task_id}, {"$set": updates})
        updated = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if updates.get("assigned_editor_id"):
            await server.create_notification(updates["assigned_editor_id"], "moderator_assigned", f"Project assigned: {updated.get('title')}", link="/editor/projects")
        await server.notify_role("admin", "moderator_task_update", f"Moderator updated: {updated.get('title')}", body=", ".join(updates.keys()), link="/admin/tasks")
        return hide_money(updated)

    @router.post("/moderator/tasks/{task_id}/approve-video")
    async def moderator_approve_video(task_id: str, user: dict = Depends(server.get_current_user)):
        await require_moderator_permission(server, user, "review_files")
        task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not task or task.get("status") != "submitted":
            raise HTTPException(400, "Task not pending file review")
        await server.db.tasks.update_one({"id": task_id}, {"$set": {"status": "client_review", "updated_at": now_iso(), "reviewed_by_moderator_id": user.get("id")}})
        if task.get("client_id"):
            await server.create_notification(task["client_id"], "draft_ready", f"Draft ready for '{task['title']}'", link="/client/panel")
        return {"ok": True}

    @router.post("/moderator/tasks/{task_id}/send-back")
    async def moderator_send_back(task_id: str, data: ModeratorSendBackIn, user: dict = Depends(server.get_current_user)):
        await require_moderator_permission(server, user, "send_back")
        task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not task:
            raise HTTPException(404, "Task not found")
        editor_id = task.get("assigned_editor_id")
        if not editor_id:
            raise HTTPException(400, "No editor assigned")
        feedback = {"id": str(server.uuid.uuid4()), "note": data.note or "Sent back by Moderator for update.", "created_at": now_iso(), "created_by": user.get("id"), "created_by_role": "moderator"}
        await server.db.tasks.update_one({"id": task_id}, {"$push": {"moderator_feedback": feedback}, "$set": {"status": "revision", "updated_at": now_iso()}})
        await server.create_notification(editor_id, "moderator_sent_back", f"Update needed: {task.get('title')}", body=feedback["note"], link="/editor/projects")
        return {"ok": True, "feedback": feedback}

    @router.get("/moderator/messages")
    async def moderator_messages(client_id: str, user: dict = Depends(server.get_current_user)):
        await require_moderator_permission(server, user, "reply_clients")
        return await server.db.messages.find({"channel": f"dm:{client_id}"}, {"_id": 0}).sort("created_at", 1).to_list(1000)

    @router.post("/moderator/messages")
    async def moderator_send_message(data: ModeratorMessageIn, user: dict = Depends(server.get_current_user)):
        await require_moderator_permission(server, user, "reply_clients")
        client = await server.db.users.find_one({"id": data.client_id, "role": "client"})
        if not client:
            raise HTTPException(404, "Client not found")
        msg = {"id": str(server.uuid.uuid4()), "channel": f"dm:{data.client_id}", "sender_id": user["id"], "sender_name": user.get("real_name") or "Moderator", "sender_role": "moderator", "content": data.content, "created_at": now_iso()}
        await server.db.messages.insert_one(msg.copy())
        msg.pop("_id", None)
        return msg

    @router.post("/moderator/notify-admin")
    async def moderator_notify_admin(data: ModeratorNotifyAdminIn, user: dict = Depends(server.get_current_user)):
        await require_moderator_permission(server, user, "notify_admin")
        await server.notify_role("admin", "moderator_owner_alert", data.title, body=data.body, link="/admin")
        return {"ok": True}

    return router
