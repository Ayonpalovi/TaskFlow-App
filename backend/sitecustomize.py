"""Motionholic OS runtime patches.

This file is loaded automatically by Python before `server.py` starts on Render.
It keeps the project pipeline manual: available projects do not move to active
unless Admin/Moderator assigns an editor or approves an editor request.
"""

import asyncio
import sys
from datetime import datetime, timezone
from fastapi.applications import FastAPI

_original_include_router = FastAPI.include_router
_original_call = FastAPI.__call__
_original_on_event = FastAPI.on_event

_attached_account = False
_attached_workflow = False
_attached_workflow_chat = False
_attached_moderator = False
_attached_task_create_override = False
_attached_moderator_create_task = False
_attached_moderator_account_patch = False
_attached_moderator_finance = False
_attached_moderator_escalation_notify = False
_attached_request_approval_override = False
_patched_pipeline_scheduler = False
_patched_auto_move_db_guards = False


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


def _collection_name(collection):
    try:
        return collection.name
    except Exception:
        return ""


def _is_auto_task_move_update(update):
    if not isinstance(update, dict):
        return False
    set_data = update.get("$set") if isinstance(update.get("$set"), dict) else {}
    return bool(set_data.get("auto_assigned") or set_data.get("auto_approved"))


def _is_auto_request_resolution(update):
    if not isinstance(update, dict):
        return False
    set_data = update.get("$set") if isinstance(update.get("$set"), dict) else {}
    return set_data.get("status") == "auto_resolved"


def _patch_auto_move_db_guards(server):
    """Block old background scheduler writes even if a stale scheduler loop exists."""
    global _patched_auto_move_db_guards
    if _patched_auto_move_db_guards or not hasattr(server, "db") or not hasattr(server.db, "tasks"):
        return

    collection_cls = type(server.db.tasks)
    original_update_one = collection_cls.update_one
    original_update_many = collection_cls.update_many

    async def guarded_update_one(self, filter, update, *args, **kwargs):
        if _collection_name(self) == "tasks" and _is_auto_task_move_update(update):
            print("Motionholic blocked automatic task board movement")
            return await original_update_one(
                self,
                {"id": "__motionholic_blocked_auto_task_move__"},
                {"$set": {"blocked_at": _now_iso()}},
                *args,
                **kwargs,
            )
        return await original_update_one(self, filter, update, *args, **kwargs)

    async def guarded_update_many(self, filter, update, *args, **kwargs):
        if _collection_name(self) == "requests" and _is_auto_request_resolution(update):
            print("Motionholic blocked automatic request resolution")
            return await original_update_many(
                self,
                {"id": "__motionholic_blocked_auto_request_resolution__"},
                {"$set": {"blocked_at": _now_iso()}},
                *args,
                **kwargs,
            )
        return await original_update_many(self, filter, update, *args, **kwargs)

    collection_cls.update_one = guarded_update_one
    collection_cls.update_many = guarded_update_many
    _patched_auto_move_db_guards = True
    print("Motionholic automatic pipeline DB guard attached")


def _patch_manual_pipeline_scheduler(server):
    """Disable auto-assign and auto-approve scheduler logic at the source."""
    global _patched_pipeline_scheduler
    if _patched_pipeline_scheduler:
        return

    async def manual_only_scheduler_tick():
        return None

    async def manual_only_scheduler_loop():
        while True:
            try:
                await manual_only_scheduler_tick()
            except Exception as exc:
                logger = getattr(server, "logger", None)
                if logger:
                    logger.error(f"manual scheduler error: {exc}")
                else:
                    print(f"manual scheduler error: {exc}")
            await asyncio.sleep(60)

    server.scheduler_tick = manual_only_scheduler_tick
    server.scheduler_loop = manual_only_scheduler_loop
    _patched_pipeline_scheduler = True
    print("Motionholic pipeline scheduler disabled: available tasks stay available until manual assignment/request approval")


def _patch_server_runtime(server):
    if server is None or not hasattr(server, "db"):
        return
    _patch_auto_move_db_guards(server)
    _patch_manual_pipeline_scheduler(server)


def _has_route(app, path, method=None):
    target_method = method.upper() if method else None
    for route in getattr(app, "routes", []):
        if getattr(route, "path", "") != path:
            continue
        if not target_method:
            return True
        if target_method in (getattr(route, "methods", None) or set()):
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
                idx for idx, existing in enumerate(app.router.routes)
                if id(existing) not in new_route_ids
                and getattr(existing, "path", "") == path
                and _route_has_method(existing, method)
            ),
            len(app.router.routes),
        )
        app.router.routes.insert(insert_at, route)


def _include_before_existing(app, router, path, method):
    before = {id(route) for route in getattr(app, "routes", [])}
    _original_include_router(app, router)
    new_routes = [route for route in getattr(app, "routes", []) if id(route) not in before]
    _move_routes_before_existing(app, new_routes, path, method)


def _attach_request_approval_override(app, server):
    """Allow both Admin and Moderator to approve editor requests.

    Approving a request is one of the only valid ways an Available project becomes Active.
    """
    global _attached_request_approval_override
    if _attached_request_approval_override or not _has_route(app, "/api/requests/{req_id}/approve", "POST"):
        return

    from fastapi import APIRouter, Depends, HTTPException

    router = APIRouter(prefix="/api", tags=["request-approval-override"])

    @router.post("/requests/{req_id}/approve")
    async def approve_request_by_admin_or_moderator(req_id: str, user: dict = Depends(server.get_current_user)):
        if user.get("role") not in {"admin", "moderator"}:
            raise HTTPException(403, "Admin or moderator only")

        request = await server.db.requests.find_one({"id": req_id}, {"_id": 0})
        if not request:
            raise HTTPException(404, "Request not found")
        if request.get("status") != "pending":
            raise HTTPException(400, "Request is not pending")

        task = await server.db.tasks.find_one({"id": request["task_id"]}, {"_id": 0})
        if not task:
            raise HTTPException(404, "Task not found")
        if task.get("status") != "available":
            raise HTTPException(400, "Only available tasks can be assigned from editor requests")

        await server.db.tasks.update_one(
            {"id": request["task_id"]},
            {"$set": {
                "assigned_editor_id": request["editor_id"],
                "editor_id": request["editor_id"],
                "status": "active",
                "assigned_by": user["id"],
                "assigned_by_role": user["role"],
                "updated_at": _now_iso(),
            }},
        )
        await server.db.requests.update_one(
            {"id": req_id},
            {"$set": {"status": "approved", "approved_by": user["id"], "approved_by_role": user["role"], "updated_at": _now_iso()}},
        )
        await server.db.requests.update_many(
            {"task_id": request["task_id"], "id": {"$ne": req_id}, "status": "pending"},
            {"$set": {"status": "rejected", "updated_at": _now_iso()}},
        )
        if hasattr(server, "create_notification"):
            await server.create_notification(request["editor_id"], "request_approved", f"Request approved: {task.get('title', 'Project')}", link="/editor/projects")
        return {"ok": True}

    _include_before_existing(app, router, "/api/requests/{req_id}/approve", "POST")
    _attached_request_approval_override = True
    print("Motionholic request approval override attached")


def _attach_task_create_override_router(app, server):
    global _attached_task_create_override
    if _attached_task_create_override or not _has_route(app, "/api/tasks", "POST"):
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

        if client_id and not await server.db.users.find_one({"id": client_id, "role": "client"}, {"_id": 0}):
            raise HTTPException(404, "Client not found")
        if assigned_editor_id and not await server.db.users.find_one({"id": assigned_editor_id, "role": "editor"}, {"_id": 0}):
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

    _include_before_existing(app, router, "/api/tasks", "POST")
    _attached_task_create_override = True
    print("Motionholic task create override route attached")


def _attach_optional_routers(app, server):
    global _attached_account, _attached_workflow, _attached_workflow_chat, _attached_moderator
    global _attached_moderator_create_task, _attached_moderator_account_patch
    global _attached_moderator_finance, _attached_moderator_escalation_notify

    existing_paths = {getattr(route, "path", "") for route in getattr(app, "routes", [])}

    try:
        if not _attached_moderator_account_patch:
            from moderator_account_patch import build_moderator_account_patch_router
            _original_include_router(app, build_moderator_account_patch_router(server))
            _attached_moderator_account_patch = True
    except Exception as exc:
        print(f"Motionholic moderator account patch loader failed: {exc}")

    try:
        if not _attached_account and "/api/account/users/invite" not in existing_paths:
            from account_status import install_status_patch
            from account_routes import build_account_router
            install_status_patch(server)
            _original_include_router(app, build_account_router(server))
            _attached_account = True
    except Exception as exc:
        print(f"Motionholic account route loader failed: {exc}")

    try:
        if not _attached_workflow:
            from workflow_api import build_task_compat_router, build_workflow_router
            if "/api/workflow/state" not in existing_paths:
                _original_include_router(app, build_workflow_router(server))
            if "/api/tasks/{task_id}" not in existing_paths:
                _original_include_router(app, build_task_compat_router(server))
            _attached_workflow = True
    except Exception as exc:
        print(f"Motionholic workflow route loader failed: {exc}")

    try:
        if not _attached_workflow_chat and "/api/workflow/chat/conversations" not in existing_paths:
            from fastapi import APIRouter
            from workflow_chat_api import attach_workflow_chat_routes
            chat_router = APIRouter(prefix="/api/workflow", tags=["workflow-chat"])
            attach_workflow_chat_routes(chat_router, server)
            _original_include_router(app, chat_router)
            _attached_workflow_chat = True
    except Exception as exc:
        print(f"Motionholic workflow chat route loader failed: {exc}")

    try:
        if not _attached_moderator_create_task and not _has_route(app, "/api/workflow/moderator/tasks", "POST"):
            from moderator_create_task_patch import build_moderator_create_task_router
            _original_include_router(app, build_moderator_create_task_router(server))
            _attached_moderator_create_task = True
    except Exception as exc:
        print(f"Motionholic moderator create task route loader failed: {exc}")

    try:
        if not _attached_moderator and "/api/moderator/dashboard" not in existing_paths:
            from moderator_routes import build_moderator_router
            _original_include_router(app, build_moderator_router(server))
            _attached_moderator = True
    except Exception as exc:
        print(f"Motionholic moderator route loader failed: {exc}")

    try:
        if not _attached_moderator_finance and "/api/moderator/finance-access" not in existing_paths:
            from moderator_finance_access import build_moderator_finance_router
            _original_include_router(app, build_moderator_finance_router(server))
            _attached_moderator_finance = True
    except Exception as exc:
        print(f"Motionholic moderator finance route loader failed: {exc}")

    try:
        if not _attached_moderator_escalation_notify:
            from moderator_escalation_notify_patch import build_moderator_escalation_notify_router
            _include_before_existing(app, build_moderator_escalation_notify_router(server), "/api/moderator/escalations", "POST")
            _attached_moderator_escalation_notify = True
    except Exception as exc:
        print(f"Motionholic moderator escalation notification loader failed: {exc}")


def _attach_extension_routers(app):
    server = _find_server_module()
    if server is None or not hasattr(server, "db") or not hasattr(server, "get_current_user"):
        return

    _patch_server_runtime(server)
    try:
        _attach_task_create_override_router(app, server)
    except Exception as exc:
        print(f"Motionholic task create override loader failed: {exc}")
    try:
        _attach_request_approval_override(app, server)
    except Exception as exc:
        print(f"Motionholic request approval override loader failed: {exc}")
    _attach_optional_routers(app, server)


def _patched_include_router(self, router, *args, **kwargs):
    result = _original_include_router(self, router, *args, **kwargs)
    if getattr(router, "prefix", None) == "/api":
        _attach_extension_routers(self)
    return result


def _patched_on_event(self, event_type):
    decorator = _original_on_event(self, event_type)

    def wrapper(func):
        if event_type != "startup":
            return decorator(func)

        async def startup_with_manual_pipeline(*args, **kwargs):
            _patch_server_runtime(_find_server_module())
            return await func(*args, **kwargs)

        startup_with_manual_pipeline.__name__ = getattr(func, "__name__", "startup_with_manual_pipeline")
        return decorator(startup_with_manual_pipeline)

    return wrapper


async def _patched_call(self, scope, receive, send):
    _attach_extension_routers(self)
    return await _original_call(self, scope, receive, send)


FastAPI.include_router = _patched_include_router
FastAPI.on_event = _patched_on_event
FastAPI.__call__ = _patched_call
