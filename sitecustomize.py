"""Root-level extension loader for Render.

Render can start the FastAPI app from the repository root with a command like
`uvicorn backend.server:app`. Python only auto-loads `sitecustomize.py` from
folders on sys.path, so the previous `backend/sitecustomize.py` may not run in
that setup. This root file makes the account/workflow route extensions load
from either runtime location.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path
from fastapi.applications import FastAPI

ROOT_DIR = Path(__file__).parent
BACKEND_DIR = ROOT_DIR / "backend"
if BACKEND_DIR.exists() and str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_original_include_router = FastAPI.include_router
_original_call = FastAPI.__call__
_attached = False
_attached_task_create_override = False


def _find_server_module():
    return sys.modules.get("backend.server") or sys.modules.get("server") or sys.modules.get("__main__")


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _clean_doc(doc):
    out = dict(doc or {})
    out.pop("_id", None)
    return out


def _to_number(value, fallback=0):
    try:
        return float(value or fallback)
    except Exception:
        return fallback


def _to_int(value, fallback=1):
    try:
        return int(value or fallback)
    except Exception:
        return fallback


def _route_has_method(route, method):
    return method.upper() in (getattr(route, "methods", None) or set())


def _has_route(app, path, method):
    return any(
        getattr(route, "path", "") == path and _route_has_method(route, method)
        for route in getattr(app, "routes", [])
    )


def _move_new_route_before_original(app, new_routes, path, method):
    new_ids = {id(route) for route in new_routes}
    for route in new_routes:
        if getattr(route, "path", "") != path or not _route_has_method(route, method):
            continue
        try:
            app.router.routes.remove(route)
        except ValueError:
            continue
        insert_at = next(
            (
                index
                for index, existing in enumerate(app.router.routes)
                if id(existing) not in new_ids
                and getattr(existing, "path", "") == path
                and _route_has_method(existing, method)
            ),
            len(app.router.routes),
        )
        app.router.routes.insert(insert_at, route)


def _attach_task_create_override(app, server):
    """Allow moderators to publish projects through POST /api/tasks, like admin."""
    global _attached_task_create_override
    if _attached_task_create_override:
        return
    if not _has_route(app, "/api/tasks", "POST"):
        return

    from fastapi import APIRouter, Depends, HTTPException
    import uuid

    router = APIRouter(prefix="/api", tags=["task-create-moderator-override"])

    @router.post("/tasks")
    async def create_task_with_moderator(payload: dict, user: dict = Depends(server.get_current_user)):
        role = user.get("role")
        if role not in {"admin", "moderator", "client"}:
            raise HTTPException(403, "Only admin, moderator or client can create tasks")

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

        if role == "client":
            status = "pending_admin_approval"
            client_id = user["id"]
            assigned_editor_id = None
            is_draft = False
        else:
            client_id = data.get("client_id") or None
            assigned_editor_id = data.get("assigned_editor_id") or None
            is_draft = bool(data.get("is_draft"))
            status = "draft" if is_draft else ("active" if assigned_editor_id else "available")

        if client_id:
            client = await server.db.users.find_one({"id": client_id, "role": "client"}, {"_id": 0})
            if not client:
                raise HTTPException(404, "Client not found")

        if assigned_editor_id:
            editor = await server.db.users.find_one({"id": assigned_editor_id, "role": "editor"}, {"_id": 0})
            if not editor:
                raise HTTPException(404, "Editor not found")

        for key in ["_id", "id", "created_at", "updated_at", "created_by", "creator_role", "status", "available_at", "submitted_at", "video_url"]:
            data.pop(key, None)

        data["skill_tags"] = data.get("skill_tags") if isinstance(data.get("skill_tags"), list) else []
        data["num_videos"] = _to_int(data.get("num_videos"), 1)
        data["revenue"] = _to_number(data.get("revenue"), 0)
        data["cost"] = _to_number(data.get("cost"), 0)

        created_at = _now_iso()
        doc = {
            "id": str(uuid.uuid4()),
            "status": status,
            "created_at": created_at,
            "updated_at": created_at,
            "created_by": user["id"],
            "creator_role": role,
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
            "assigned_editor_id": assigned_editor_id,
            "is_draft": is_draft,
        }

        await server.db.tasks.insert_one(doc.copy())

        if status == "pending_admin_approval":
            await server.notify_role("admin", "project_pending_approval", f"New project from client: {title}", link="/admin/approvals")
        elif status == "available":
            await server.notify_role("editor", "new_brief", f"New open brief: {project_type}", link="/editor/available")
        elif status == "active" and assigned_editor_id:
            await server.create_notification(assigned_editor_id, "task_assigned", f"Assigned project: {title}", link="/editor/projects")

        if client_id and role in {"admin", "moderator"} and status != "draft":
            await server.create_notification(client_id, "project_created", f"Project created: {title}", link="/client/panel")

        return _clean_doc(doc)

    before = {id(route) for route in getattr(app, "routes", [])}
    _original_include_router(app, router)
    new_routes = [route for route in getattr(app, "routes", []) if id(route) not in before]
    _move_new_route_before_original(app, new_routes, "/api/tasks", "POST")
    _attached_task_create_override = True
    print("Motionholic moderator project publish override attached")


def _attach_extension_routers(app):
    global _attached

    try:
        server = _find_server_module()
        if server is None or not hasattr(server, "db") or not hasattr(server, "get_current_user"):
            return

        _attach_task_create_override(app, server)

        if _attached:
            return

        from fastapi import APIRouter
        from workflow_api import build_task_compat_router, build_workflow_router
        from workflow_chat_api import attach_workflow_chat_routes
        from account_status import install_status_patch
        from account_routes import build_account_router

        install_status_patch(server)

        existing_paths = {getattr(route, "path", "") for route in getattr(app, "routes", [])}

        if "/api/workflow/state" not in existing_paths:
            _original_include_router(app, build_workflow_router(server))

        if "/api/tasks/{task_id}" not in existing_paths:
            _original_include_router(app, build_task_compat_router(server))

        if "/api/account/users/invite" not in existing_paths:
            _original_include_router(app, build_account_router(server))

        _attached = True
    except Exception as exc:
        print(f"Motionholic extension route loader failed: {exc}")


def _patched_include_router(self, router, *args, **kwargs):
    result = _original_include_router(self, router, *args, **kwargs)
    if getattr(router, "prefix", None) == "/api":
        _attach_extension_routers(self)
    return result


async def _patched_call(self, scope, receive, send):
    _attach_extension_routers(self)
    return await _original_call(self, scope, receive, send)


FastAPI.include_router = _patched_include_router
FastAPI.__call__ = _patched_call
