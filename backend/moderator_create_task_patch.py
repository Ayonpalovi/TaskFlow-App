from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException


def _now():
    return datetime.now(timezone.utc).isoformat()


def _clean(doc):
    out = dict(doc or {})
    out.pop("_id", None)
    return out


def _num(value, fallback=0):
    try:
        return float(value or fallback)
    except Exception:
        return fallback


def _integer(value, fallback=1):
    try:
        return int(value or fallback)
    except Exception:
        return fallback


def build_moderator_create_task_router(server):
    router = APIRouter(prefix="/api/workflow", tags=["moderator-create-task"])

    @router.post("/moderator/tasks")
    async def moderator_create_task(payload: dict, user: dict = Depends(server.get_current_user)):
        if user.get("role") not in {"admin", "moderator"}:
            raise HTTPException(403, "Moderator or admin only")

        data = dict(payload or {})
        title = str(data.get("title") or "").strip()
        project_type = str(data.get("project_type") or "").strip()
        deadline = str(data.get("deadline") or "").strip()
        if not title:
            raise HTTPException(400, "Title is required")
        if not project_type:
            raise HTTPException(400, "Project type is required")
        if not deadline:
            raise HTTPException(400, "Deadline is required")

        editor_id = data.get("assigned_editor_id") or None
        client_id = data.get("client_id") or None

        if editor_id:
            editor = await server.db.users.find_one({"id": editor_id, "role": "editor"}, {"_id": 0})
            if not editor:
                raise HTTPException(404, "Editor not found")

        if client_id:
            client = await server.db.users.find_one({"id": client_id, "role": "client"}, {"_id": 0})
            if not client:
                raise HTTPException(404, "Client not found")

        is_draft = bool(data.get("is_draft"))
        status = "draft" if is_draft else ("active" if editor_id else "available")
        created_at = _now()

        for key in ["_id", "id", "created_at", "updated_at", "created_by", "creator_role", "status"]:
            data.pop(key, None)

        data["num_videos"] = _integer(data.get("num_videos"), 1)
        data["revenue"] = _num(data.get("revenue"), 0)
        data["cost"] = _num(data.get("cost"), 0)
        if not isinstance(data.get("skill_tags"), list):
            data["skill_tags"] = []

        doc = {
            "id": str(uuid4()),
            "status": status,
            "created_at": created_at,
            "updated_at": created_at,
            "created_by": user["id"],
            "creator_role": user["role"],
            "available_at": created_at if status == "available" else None,
            "submitted_at": None,
            "video_url": None,
            "drafts": [],
            "revisions": [],
            **data,
            "title": title,
            "project_type": project_type,
            "deadline": deadline,
            "client_id": client_id,
            "assigned_editor_id": editor_id,
            "is_draft": is_draft,
        }

        await server.db.tasks.insert_one(doc.copy())

        if status == "available":
            await server.notify_role("editor", "new_brief", "New open brief: " + project_type, link="/editor/available")
        if status == "active" and editor_id:
            await server.create_notification(editor_id, "task_assigned", "Assigned project: " + title, link="/editor/projects")
        if client_id and status != "draft":
            await server.create_notification(client_id, "project_created", "Project created: " + title, link="/client/panel")

        return _clean(doc)

    return router
