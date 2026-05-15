"""Attach Motionholic OS extension routes without rewriting server.py.

Render starts this backend with `uvicorn server:app`, so this file is loaded
from the backend folder at Python startup. Keep each extension independent so a
workflow import issue cannot block account routes.
"""

import sys
from datetime import datetime, timezone
from fastapi.applications import FastAPI

_original_include_router = FastAPI.include_router
_original_call = FastAPI.__call__
_attached_account = False
_attached_workflow = False
_attached_workflow_chat = False
_attached_moderator = False
_attached_task_create_override = False
_attached_moderator_create_task = False
_attached_moderator_account_patch = False
_attached_moderator_finance = False


def _find_server_module():
    return sys.modules.get("server") or sys.modules.get("backend.server") or sys.modules.get("__main__")


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


def _has_route(app, path, method=None):
    target_method = method.upper() if method else None
    for route in getattr(app, "routes", []):
        if getattr(route, "path", "") != path:
            continue
        if not target_method:
            return True
        methods = getattr(route, "methods", None) or set()
        if target_method in methods:
            return True
    return False


def _route_has_method(route, method):
    return method.upper() in (getattr(route, "methods", None) or set())


def _move_routes_before_existing(app, new_routes, path, method):
    new_route_ids = {id(route) for route in new_routes}
    for route in new_routes:
        if getattr(route, "path", "") != path or not _route_has_method(route, method):
            continue
        try:
            app.router.routes.remove(route)
        except ValueError:
            continue
        insert_at = next(
            (
                idx
                for idx, existing in enumerate(app.router.routes)
                if id(existing) not in new_route_ids
                and getattr(existing, "path", "") == path
                and _route_has_method(existing, method)
            ),
            len(app.router.routes),
        )
        app.router.routes.insert(insert_at, route)


def _attach_task_create_override_router(app, server, existing_paths):
    """Let moderators create/publish projects through the same /api/tasks path as admins.

    The original server route allows admin and client only. This override is inserted
    before the original POST /api/tasks route and keeps admin/client behavior intact
    while adding moderator as an ops role.
    """
    global _attached_task_create_override
    if _attached_task_create_override:
        return
    if not _has_route(app, "/api/tasks", "POST"):
        return

    from fastapi import APIRouter, Depends, HTTPException
    import uuid

    router = APIRouter(prefix="/api", tags=["task-create-override"])

    @router.post("/tasks")
    async def create_task_for_admin_client_moderator(payload: dict, user: dict = Depends(server.get_current_user)):
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
    _move_routes_before_existing(app, new_routes, "/api/tasks", "POST")
    _attached_task_create_override = True
    print("Motionholic task create override route attached")


def _attach_moderator_account_patch(app, server, existing_paths):
    global _attached_moderator_account_patch
    if _attached_moderator_account_patch:
        return

    from moderator_account_patch import build_moderator_account_patch_router

    _original_include_router(app, build_moderator_account_patch_router(server))
    _attached_moderator_account_patch = True
    print("Motionholic moderator account patch routes attached")


def _attach_account_router(app, server, existing_paths):
    global _attached_account
    if _attached_account or "/api/account/users/invite" in existing_paths:
        _attached_account = True
        return

    from account_status import install_status_patch
    from account_routes import build_account_router

    install_status_patch(server)
    _original_include_router(app, build_account_router(server))
    _attached_account = True
    print("Motionholic account routes attached")


def _attach_workflow_routers(app, server, existing_paths):
    global _attached_workflow
    if _attached_workflow:
        return

    from workflow_api import build_task_compat_router, build_workflow_router

    if "/api/workflow/state" not in existing_paths:
        _original_include_router(app, build_workflow_router(server))

    if "/api/tasks/{task_id}" not in existing_paths:
        _original_include_router(app, build_task_compat_router(server))

    _attached_workflow = True
    print("Motionholic workflow routes attached")


def _attach_workflow_chat_router(app, server, existing_paths):
    global _attached_workflow_chat
    if _attached_workflow_chat or "/api/workflow/chat/conversations" in existing_paths:
        _attached_workflow_chat = True
        return

    from fastapi import APIRouter
    from workflow_chat_api import attach_workflow_chat_routes

    chat_router = APIRouter(prefix="/api/workflow", tags=["workflow-chat"])
    attach_workflow_chat_routes(chat_router, server)
    _original_include_router(app, chat_router)
    _attached_workflow_chat = True
    print("Motionholic workflow chat routes attached")


def _attach_moderator_create_task_router(app, server, existing_paths):
    global _attached_moderator_create_task
    if _attached_moderator_create_task:
        return

    if _has_route(app, "/api/workflow/moderator/tasks", "POST"):
        _attached_moderator_create_task = True
        return

    from moderator_create_task_patch import build_moderator_create_task_router

    _original_include_router(app, build_moderator_create_task_router(server))
    _attached_moderator_create_task = True
    print("Motionholic moderator create task route attached")


def _attach_moderator_router(app, server, existing_paths):
    global _attached_moderator
    if _attached_moderator or "/api/moderator/dashboard" in existing_paths:
        _attached_moderator = True
        return

    from moderator_routes import build_moderator_router

    _original_include_router(app, build_moderator_router(server))
    _attached_moderator = True
    print("Motionholic moderator routes attached")


def _attach_moderator_finance_router(app, server, existing_paths):
    global _attached_moderator_finance
    if _attached_moderator_finance or "/api/moderator/finance-access" in existing_paths:
        _attached_moderator_finance = True
        return

    from moderator_finance_access import build_moderator_finance_router

    _original_include_router(app, build_moderator_finance_router(server))
    _attached_moderator_finance = True
    print("Motionholic moderator finance routes attached")


def _attach_extension_routers(app):
    server = _find_server_module()
    if server is None or not hasattr(server, "db") or not hasattr(server, "get_current_user"):
        return

    existing_paths = {getattr(route, "path", "") for route in getattr(app, "routes", [])}

    try:
        _attach_task_create_override_router(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic task create override loader failed: {exc}")

    try:
        _attach_moderator_account_patch(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic moderator account patch loader failed: {exc}")

    try:
        _attach_account_router(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic account route loader failed: {exc}")

    try:
        _attach_workflow_routers(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic workflow route loader failed: {exc}")

    try:
        _attach_workflow_chat_router(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic workflow chat route loader failed: {exc}")

    try:
        _attach_moderator_create_task_router(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic moderator create task route loader failed: {exc}")

    try:
        _attach_moderator_router(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic moderator route loader failed: {exc}")

    try:
        _attach_moderator_finance_router(app, server, existing_paths)
    except Exception as exc:
        print(f"Motionholic moderator finance route loader failed: {exc}")


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
