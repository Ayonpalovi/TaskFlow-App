from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from account_status import now_iso, visible_user


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

SAFE_MODERATOR_STATUSES = {
    "available",
    "active",
    "submitted",
    "client_review",
    "revision",
    "completed",
}


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
    assigned_editor_id: Optional[str] = None


class ModeratorNotifyAdminIn(BaseModel):
    title: str
    body: str = ""
    task_id: Optional[str] = None


class ModeratorMessageIn(BaseModel):
    client_id: str
    content: str


def _parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except Exception:
        return None


def _is_mode_active(mode: dict) -> bool:
    if not mode or not mode.get("active"):
        return False
    ends_at = _parse_dt(mode.get("ends_at"))
    if ends_at and ends_at < datetime.now(timezone.utc):
        return False
    return True


def _clean_permissions(values):
    allowed = set(DEFAULT_MODERATOR_PERMISSIONS)
    return [item for item in values if item in allowed]


def _sanitize_task(task: dict) -> dict:
    clean = dict(task)
    clean.pop("_id", None)
    clean.pop("revenue", None)
    clean.pop("cost", None)
    return clean


async def _get_absence_mode(server) -> dict:
    mode = await server.db.system_state.find_one({"key": "absence_mode"}, {"_id": 0})
    if not mode:
        return {
            "key": "absence_mode",
            "active": False,
            "allowed_permissions": DEFAULT_MODERATOR_PERMISSIONS,
            "restricted_permissions": [],
        }
    if mode.get("active") and not _is_mode_active(mode):
        await server.db.system_state.update_one(
            {"key": "absence_mode"},
            {"$set": {"active": False, "auto_disabled_at": now_iso()}},
            upsert=True,
        )
        mode["active"] = False
    return mode


async def _require_moderator_permission(server, user: dict, permission: str) -> dict:
    if user.get("role") == "admin":
        return await _get_absence_mode(server)

    if user.get("role") != "moderator":
        raise HTTPException(403, "Moderator access only")

    mode = await _get_absence_mode(server)
    if not _is_mode_active(mode):
        raise HTTPException(403, "Absence Mode is not active")

    if mode.get("moderator_id") != user.get("id"):
        raise HTTPException(403, "You are not the selected Moderator for the active Absence Mode")

    allowed = set(mode.get("allowed_permissions") or DEFAULT_MODERATOR_PERMISSIONS)
    restricted = set(mode.get("restricted_permissions") or [])

    if permission not in allowed or permission in restricted:
        raise HTTPException(403, f"Moderator permission blocked: {permission}")

    return mode


def build_moderator_router(server):
    router = APIRouter(prefix="/api")

    @router.get("/absence-mode")
    async def get_absence_mode(user: dict = Depends(server.get_current_user)):
        mode = await _get_absence_mode(server)
        mode = dict(mode)
        moderator_id = mode.get("moderator_id")

        if moderator_id and user.get("role") == "admin":
            moderator = await server.db.users.find_one({"id": moderator_id}, {"_id": 0, "password_hash": 0})
            if moderator:
                mode["moderator"] = visible_user(server, moderator, viewer_role="admin")

        if user.get("role") == "moderator" and moderator_id != user.get("id"):
            mode.pop("note", None)
            mode.pop("allowed_permissions", None)
            mode.pop("restricted_permissions", None)

        return mode

    @router.put("/absence-mode")
    async def enable_absence_mode(data: AbsenceModeIn, admin: dict = Depends(server.require_role("admin"))):
        moderator = await server.db.users.find_one({"id": data.moderator_id}, {"_id": 0, "password_hash": 0})
        if not moderator or moderator.get("role") != "moderator":
            raise HTTPException(400, "Select a valid Moderator account")
        if moderator.get("status") == "deactivated":
            raise HTTPException(400, "Selected Moderator account is deactivated")

        duration_hours = max(1, min(int(data.duration_hours or 24), 24 * 30))
        starts_at = datetime.now(timezone.utc)
        ends_at = starts_at + timedelta(hours=duration_hours)
        allowed = _clean_permissions(data.allowed_permissions or DEFAULT_MODERATOR_PERMISSIONS)
        restricted = _clean_permissions(data.restricted_permissions or [])
        doc = {
            "key": "absence_mode",
            "active": True,
            "moderator_id": moderator["id"],
            "moderator_name": moderator.get("real_name") or moderator.get("display_name") or moderator.get("email"),
            "allowed_permissions": allowed,
            "restricted_permissions": restricted,
            "note": data.note or "",
            "starts_at": starts_at.isoformat(),
            "ends_at": ends_at.isoformat(),
            "enabled_by_admin_id": admin["id"],
            "updated_at": now_iso(),
        }

        await server.db.system_state.update_one({"key": "absence_mode"}, {"$set": doc}, upsert=True)
        await server.create_notification(moderator["id"], "absence_mode_enabled", "Absence Mode is active", body="You are now managing Motionholic OS operations temporarily.", link="/moderator")
        await server.notify_role("admin", "absence_mode_enabled", "Absence Mode enabled", body=f"Moderator: {doc['moderator_name']}")
        return doc | {"moderator": visible_user(server, moderator, viewer_role="admin")}

    @router.delete("/absence-mode")
    async def disable_absence_mode(admin: dict = Depends(server.require_role("admin"))):
        mode = await _get_absence_mode(server)
        await server.db.system_state.update_one(
            {"key": "absence_mode"},
            {"$set": {"active": False, "disabled_at": now_iso(), "disabled_by_admin_id": admin["id"], "updated_at": now_iso()}},
            upsert=True,
        )
        if mode.get("moderator_id"):
            await server.create_notification(mode["moderator_id"], "absence_mode_disabled", "Absence Mode turned off", body="Owner/Admin has resumed full operations.", link="/moderator")
        await server.notify_role("admin", "absence_mode_disabled", "Absence Mode disabled")
        return {"ok": True}

    @router.get("/moderator/dashboard")
    async def moderator_dashboard(user: dict = Depends(server.get_current_user)):
        await _require_moderator_permission(server, user, "view_projects")

        tasks = await server.db.tasks.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
        visible_tasks = [_sanitize_task(t) for t in tasks if t.get("status") != "draft"]

        editors = await server.db.users.find({"role": "editor", "status": {"$ne": "deactivated"}}, {"_id": 0, "password_hash": 0}).to_list(500)
        workload = []
        for editor in editors:
            active = await server.db.tasks.count_documents({"assigned_editor_id": editor["id"], "status": "active"})
            submitted = await server.db.tasks.count_documents({"assigned_editor_id": editor["id"], "status": "submitted"})
            revision = await server.db.tasks.count_documents({"assigned_editor_id": editor["id"], "status": "revision"})
            total = active + submitted + revision
            workload.append({
                "editor": server.scrub_user(editor, viewer_role="moderator"),
                "active": active,
                "submitted": submitted,
                "revision": revision,
                "total": total,
                "load_pct": min(100, round((total / 5) * 100)),
                "status": "overloaded" if total >= 5 else "busy" if total >= 3 else "available",
            })
        workload.sort(key=lambda row: row["total"], reverse=True)

        clients = await server.db.users.find({"role": "client", "status": {"$ne": "deactivated"}}, {"_id": 0, "password_hash": 0}).to_list(500)
        client_progress = []
        for client in clients:
            client_tasks = [t for t in visible_tasks if t.get("client_id") == client.get("id")]
            if not client_tasks:
                continue
            client_progress.append({
                "client": server.scrub_user(client, viewer_role="moderator"),
                "total": len(client_tasks),
                "completed": sum(1 for t in client_tasks if t.get("status") == "completed"),
                "revision": sum(1 for t in client_tasks if t.get("status") == "revision"),
                "in_progress": sum(1 for t in client_tasks if t.get("status") in ["active", "submitted", "client_review"]),
            })

        pending_requests = await server.db.requests.find({"status": "pending"}, {"_id": 0}).sort("created_at", -1).to_list(200)
        for request in pending_requests:
            editor = await server.db.users.find_one({"id": request.get("editor_id")}, {"_id": 0, "password_hash": 0})
            task = await server.db.tasks.find_one({"id": request.get("task_id")}, {"_id": 0})
            if editor:
                request["editor"] = server.scrub_user(editor, viewer_role="moderator")
            if task:
                request["task"] = _sanitize_task(task)

        mode = await _get_absence_mode(server)
        return {
            "absence_mode": mode,
            "tasks": visible_tasks,
            "workload": workload,
            "client_progress": client_progress,
            "pending_requests": pending_requests,
            "editors": [server.scrub_user(e, viewer_role="moderator") for e in editors],
        }

    @router.get("/moderator/tasks/{task_id}/recommendations")
    async def moderator_recommendations(task_id: str, user: dict = Depends(server.get_current_user)):
        await _require_moderator_permission(server, user, "assign_projects")
        task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not task:
            raise HTTPException(404, "Task not found")
        editors = await server.db.users.find({"role": "editor", "status": {"$ne": "deactivated"}}, {"_id": 0, "password_hash": 0}).to_list(500)
        skill_tags = set([s.lower() for s in task.get("skill_tags", [])])
        output = []
        for editor in editors:
            metrics = await server.compute_editor_metrics(editor["id"])
            editor_skills = set([s.lower() for s in editor.get("skills", [])])
            skill_match = (len(skill_tags & editor_skills) / len(skill_tags) * 100) if skill_tags else 50
            active_load = await server.db.tasks.count_documents({"assigned_editor_id": editor["id"], "status": {"$in": ["active", "submitted", "revision"]}})
            availability = max(0, 100 - active_load * 20)
            overall = round(0.4 * skill_match + 0.35 * metrics["score"] + 0.25 * availability, 1)
            output.append({
                "editor": server.scrub_user(editor, viewer_role="moderator"),
                "skill_match": round(skill_match, 1),
                "performance_score": metrics["score"],
                "availability": availability,
                "overall": overall,
            })
        output.sort(key=lambda row: row["overall"], reverse=True)
        return output

    @router.patch("/moderator/tasks/{task_id}")
    async def moderator_update_task(task_id: str, data: ModeratorTaskPatchIn, user: dict = Depends(server.get_current_user)):
        task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not task:
            raise HTTPException(404, "Task not found")

        updates = {}
        if data.status is not None:
            await _require_moderator_permission(server, user, "update_status")
            if data.status not in SAFE_MODERATOR_STATUSES:
                raise HTTPException(400, "Moderators cannot move projects to this status")
            updates["status"] = data.status

        if data.deadline is not None:
            await _require_moderator_permission(server, user, "manage_deadlines")
            updates["deadline"] = data.deadline

        if data.assigned_editor_id is not None:
            await _require_moderator_permission(server, user, "assign_projects")
            if data.assigned_editor_id:
                editor = await server.db.users.find_one({"id": data.assigned_editor_id, "role": "editor", "status": {"$ne": "deactivated"}})
                if not editor:
                    raise HTTPException(400, "Select a valid active editor")
            updates["assigned_editor_id"] = data.assigned_editor_id or None
            if data.assigned_editor_id and not updates.get("status"):
                updates["status"] = "active"

        if data.priority is not None:
            await _require_moderator_permission(server, user, "manage_deadlines")
            if data.priority not in ["low", "medium", "high", "urgent"]:
                raise HTTPException(400, "Invalid priority")
            updates["priority"] = data.priority

        if not updates:
            raise HTTPException(400, "No allowed changes provided")

        updates["updated_at"] = now_iso()
        updates["last_moderated_by"] = user.get("id")
        await server.db.tasks.update_one({"id": task_id}, {"$set": updates})

        updated = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if updates.get("assigned_editor_id"):
            await server.create_notification(updates["assigned_editor_id"], "moderator_assigned", f"Project assigned: {updated.get('title')}", link="/editor/projects")
        await server.notify_role("admin", "moderator_task_update", f"Moderator updated: {updated.get('title')}", body=", ".join(updates.keys()), link="/admin/tasks")
        return _sanitize_task(updated)

    @router.post("/moderator/tasks/{task_id}/approve-video")
    async def moderator_approve_video(task_id: str, user: dict = Depends(server.get_current_user)):
        await _require_moderator_permission(server, user, "review_files")
        task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not task or task.get("status") != "submitted":
            raise HTTPException(400, "Task not pending file review")
        await server.db.tasks.update_one({"id": task_id}, {"$set": {"status": "client_review", "updated_at": now_iso(), "reviewed_by_moderator_id": user.get("id")}})
        if task.get("client_id"):
            await server.create_notification(task["client_id"], "draft_ready", f"Draft ready for '{task['title']}'", link="/client/panel")
        await server.notify_role("admin", "moderator_file_approved", f"Moderator approved file: {task['title']}")
        return {"ok": True}

    @router.post("/moderator/tasks/{task_id}/send-back")
    async def moderator_send_back(task_id: str, data: ModeratorSendBackIn, user: dict = Depends(server.get_current_user)):
        await _require_moderator_permission(server, user, "send_back")
        task = await server.db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not task:
            raise HTTPException(404, "Task not found")
        editor_id = data.assigned_editor_id or task.get("assigned_editor_id")
        if not editor_id:
            raise HTTPException(400, "No editor assigned")
        feedback = {
            "id": str(server.uuid.uuid4()),
            "note": data.note or "Sent back by Moderator for update.",
            "created_at": now_iso(),
            "created_by": user.get("id"),
            "created_by_role": "moderator",
        }
        await server.db.tasks.update_one({"id": task_id}, {"$push": {"moderator_feedback": feedback}, "$set": {"status": "revision", "assigned_editor_id": editor_id, "updated_at": now_iso()}})
        await server.create_notification(editor_id, "moderator_sent_back", f"Update needed: {task.get('title')}", body=feedback["note"], link="/editor/projects")
        await server.notify_role("admin", "moderator_sent_back", f"Moderator sent back: {task.get('title')}", body=feedback["note"])
        return {"ok": True, "feedback": feedback}

    @router.post("/moderator/requests/{req_id}/approve")
    async def moderator_approve_request(req_id: str, user: dict = Depends(server.get_current_user)):
        await _require_moderator_permission(server, user, "assign_projects")
        request = await server.db.requests.find_one({"id": req_id}, {"_id": 0})
        if not request:
            raise HTTPException(404, "Request not found")
        await server.db.tasks.update_one({"id": request["task_id"]}, {"$set": {"assigned_editor_id": request["editor_id"], "status": "active", "updated_at": now_iso(), "last_moderated_by": user.get("id")}})
        await server.db.requests.update_one({"id": req_id}, {"$set": {"status": "approved", "approved_by_moderator_id": user.get("id")}})
        await server.db.requests.update_many({"task_id": request["task_id"], "id": {"$ne": req_id}}, {"$set": {"status": "rejected"}})
        await server.create_notification(request["editor_id"], "request_approved", "Your project request was approved", link="/editor/projects")
        await server.notify_role("admin", "moderator_request_approved", "Moderator approved an editor request")
        return {"ok": True}

    @router.post("/moderator/requests/{req_id}/reject")
    async def moderator_reject_request(req_id: str, user: dict = Depends(server.get_current_user)):
        await _require_moderator_permission(server, user, "assign_projects")
        await server.db.requests.update_one({"id": req_id}, {"$set": {"status": "rejected", "rejected_by_moderator_id": user.get("id")}})
        await server.notify_role("admin", "moderator_request_rejected", "Moderator rejected an editor request")
        return {"ok": True}

    @router.get("/moderator/conversations")
    async def moderator_conversations(user: dict = Depends(server.get_current_user)):
        await _require_moderator_permission(server, user, "reply_clients")
        clients = await server.db.users.find({"role": "client", "status": {"$ne": "deactivated"}}, {"_id": 0, "password_hash": 0}).to_list(500)
        return [server.scrub_user(client, viewer_role="moderator") for client in clients]

    @router.get("/moderator/messages")
    async def moderator_messages(client_id: str, user: dict = Depends(server.get_current_user)):
        await _require_moderator_permission(server, user, "reply_clients")
        client = await server.db.users.find_one({"id": client_id, "role": "client"})
        if not client:
            raise HTTPException(404, "Client not found")
        channel = f"dm:{client_id}"
        return await server.db.messages.find({"channel": channel}, {"_id": 0}).sort("created_at", 1).to_list(1000)

    @router.post("/moderator/messages")
    async def moderator_send_message(data: ModeratorMessageIn, user: dict = Depends(server.get_current_user)):
        await _require_moderator_permission(server, user, "reply_clients")
        client = await server.db.users.find_one({"id": data.client_id, "role": "client"})
        if not client:
            raise HTTPException(404, "Client not found")
        message = {
            "id": str(server.uuid.uuid4()),
            "channel": f"dm:{data.client_id}",
            "sender_id": user["id"],
            "sender_name": user.get("real_name") or "Moderator",
            "sender_role": "moderator",
            "content": data.content,
            "created_at": now_iso(),
        }
        await server.db.messages.insert_one(message.copy())
        message.pop("_id", None)
        return message

    @router.post("/moderator/notify-admin")
    async def moderator_notify_admin(data: ModeratorNotifyAdminIn, user: dict = Depends(server.get_current_user)):
        await _require_moderator_permission(server, user, "notify_admin")
        link = f"/admin/tasks" if data.task_id else "/admin"
        await server.notify_role("admin", "moderator_owner_alert", data.title, body=data.body, link=link)
        return {"ok": True}

    return router
